const fs = require('fs');
const path = require('path');
const { pgPool, getMongoDb, neo4jDriver } = require('./db');

const RETRY_QUEUE_FILE = path.join(__dirname, '../retry_queue.json');

async function processEvent(event) {
  try {
    switch (event.type) {
      case 'DRIVER_LOCATION_UPDATE':
        await handleDriverLocationUpdate(event);
        break;
      case 'PACKAGE_STATUS_CHANGE':
        await handlePackageStatusChange(event);
        break;
      case 'BILLING_EVENT':
        await handleBillingEvent(event);
        break;
      default:
        console.log(`Unknown event type: ${event.type}`);
    }
  } catch (error) {
    if (error.code === '23505') { // Postgres duplicate key error code
      console.error(`Duplicate billing event (invoice_id: ${event.payload.invoice_id}) prevented.`);
    } else {
      console.error('Error processing event:', error.message);
    }
  }
}

async function handleDriverLocationUpdate(event) {
  const { driver_id, location, zone_id } = event.payload;
  const session = neo4jDriver.session();
  try {
    await session.executeWrite(tx => tx.run(`
      MERGE (d:Driver {driverId: $driver_id})
      SET d.latitude = $lat, d.longitude = $lon
      MERGE (z:Zone {zoneId: $zone_id})
      MERGE (d)-[:LOCATED_IN]->(z)
    `, {
      driver_id,
      lat: location.lat,
      lon: location.lon,
      zone_id
    }));
  } finally {
    await session.close();
  }
}

async function handlePackageStatusChange(event) {
  const { package_id, status, driver_id, location } = event.payload;
  const db = getMongoDb();
  const packagesCollection = db.collection('packages');

  const historyEntry = {
    status,
    timestamp: event.timestamp,
    driver_id,
    location
  };

  await packagesCollection.updateOne(
    { package_id: package_id },
    { $push: { status_history: historyEntry } },
    { upsert: true }
  );
}

async function handleBillingEvent(event) {
  const { invoice_id, package_id, customer_id, amount } = event.payload;
  
  // 1. Check Document Store if package is delivered
  const db = getMongoDb();
  const packagesCollection = db.collection('packages');
  
  const pkg = await packagesCollection.findOne({ package_id });
  const isDelivered = pkg && pkg.status_history && pkg.status_history.some(h => h.status === 'DELIVERED');

  if (isDelivered) {
    // Attempt Insert to PostgreSQL
    const client = await pgPool.connect();
    try {
      await client.query(`
        INSERT INTO invoices (invoice_id, package_id, customer_id, amount)
        VALUES ($1, $2, $3, $4)
      `, [invoice_id, package_id, customer_id, amount]);
    } finally {
      client.release();
    }
  } else {
    // Append to retry queue
    let queue = [];
    if (fs.existsSync(RETRY_QUEUE_FILE)) {
      try {
        const fileContent = fs.readFileSync(RETRY_QUEUE_FILE, 'utf-8');
        if (fileContent.trim() !== '') {
          queue = JSON.parse(fileContent);
        }
      } catch (e) {
         console.error('Error reading retry queue', e);
      }
    }
    queue.push(event);
    fs.writeFileSync(RETRY_QUEUE_FILE, JSON.stringify(queue, null, 2));
    console.log(`Billing event ${invoice_id} deferred to retry queue.`);
  }
}

async function reconcileRetryQueue() {
  console.log('Running reconciliation process...');
  if (!fs.existsSync(RETRY_QUEUE_FILE)) return;

  let queue = [];
  try {
     const fileContent = fs.readFileSync(RETRY_QUEUE_FILE, 'utf-8');
     if (fileContent.trim() !== '') {
       queue = JSON.parse(fileContent);
     }
  } catch (e) {
     return;
  }

  if (queue.length === 0) return;

  const stillPending = [];

  for (const event of queue) {
    const { invoice_id, package_id, customer_id, amount } = event.payload;
    const db = getMongoDb();
    const packagesCollection = db.collection('packages');

    const pkg = await packagesCollection.findOne({ package_id });
    const isDelivered = pkg && pkg.status_history && pkg.status_history.some(h => h.status === 'DELIVERED');

    if (isDelivered) {
      try {
        const client = await pgPool.connect();
        try {
          await client.query(`
             INSERT INTO invoices (invoice_id, package_id, customer_id, amount)
             VALUES ($1, $2, $3, $4)
          `, [invoice_id, package_id, customer_id, amount]);
          console.log(`Reconciled billing event ${invoice_id}`);
        } finally {
          client.release();
        }
      } catch (error) {
        if (error.code === '23505') {
            // Already there
            console.log(`Duplicate during reconciliation ignored for ${invoice_id}`);
        } else {
             console.error(`Error inserting during reconcile ${invoice_id}`, error.message);
             stillPending.push(event); // keep in queue if other DB error
        }
      }
    } else {
      stillPending.push(event);
    }
  }

  fs.writeFileSync(RETRY_QUEUE_FILE, JSON.stringify(stillPending, null, 2));
  console.log(`Reconciliation complete. ${stillPending.length} events remain in queue.`);
}

module.exports = {
  processEvent,
  reconcileRetryQueue
};
