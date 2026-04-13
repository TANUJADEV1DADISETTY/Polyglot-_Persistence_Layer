const express = require('express');
const { pgPool, getMongoDb, neo4jDriver } = require('./db');

const router = express.Router();

router.get('/package/:package_id', async (req, res) => {
  const package_id = req.params.package_id;
  const combinedHistory = [];

  try {
    // 1. Fetch Documentation Store (Package History)
    const db = getMongoDb();
    const pkgDoc = await db.collection('packages').findOne({ package_id });
    
    let driver_id = null;
    if (pkgDoc && pkgDoc.status_history) {
      pkgDoc.status_history.forEach(historyItem => {
        if (historyItem.status === 'DELIVERED' && historyItem.driver_id) {
           driver_id = historyItem.driver_id;
        }
        combinedHistory.push({
          source_system: 'document_store',
          timestamp: historyItem.timestamp,
          event_details: historyItem
        });
      });
    }

    // 2. Fetch Relational Store (Billing)
    const pgClient = await pgPool.connect();
    try {
      const result = await pgClient.query(`SELECT * FROM invoices WHERE package_id = $1`, [package_id]);
      result.rows.forEach(row => {
        combinedHistory.push({
          source_system: 'relational_store',
          timestamp: row.created_at.toISOString(),
          event_details: {
            invoice_id: row.invoice_id,
            customer_id: row.customer_id,
            amount: parseFloat(row.amount),
            db_recorded_at: row.created_at
          }
        });
      });
    } finally {
      pgClient.release();
    }

    // 3. Fetch Graph Store (Driver Final Location)
    if (driver_id) {
      const session = neo4jDriver.session();
      try {
        const graphResult = await session.executeRead(tx => tx.run(`
          MATCH (d:Driver {driverId: $driver_id})-[:LOCATED_IN]->(z:Zone)
          RETURN d.latitude AS lat, d.longitude AS lon, z.zoneId AS zoneId
        `, { driver_id }));

        if (graphResult.records.length > 0) {
          const record = graphResult.records[0];
          combinedHistory.push({
            source_system: 'graph_store',
            // Timestamp is synthetic or missing from last update in Graph, we'll append to latest or use the Delivered time as proxy just to order roughly
            timestamp: new Date().toISOString(), 
            event_details: {
              driver_id,
              last_known_zone: record.get('zoneId'),
              lat: record.get('lat'),
              lon: record.get('lon')
            }
          });
        }
      } finally {
        await session.close();
      }
    }

    // Sort by chronological order
    combinedHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json(combinedHistory);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
