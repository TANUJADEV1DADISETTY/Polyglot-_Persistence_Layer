const express = require('express');
const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { initPostgres, initMongo, initNeo4j } = require('./db');
const { processEvent, reconcileRetryQueue } = require('./processor');
const queryRouter = require('./api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Main unified query endpoint
app.use('/query', queryRouter);

async function startServer() {
  try {
    // 1. Initialize DB connections
    await initPostgres();
    await initMongo();
    await initNeo4j();

    // 2. Start Event Ingestion Stream
    console.log('Starting log ingestion...');
    const logFilePath = path.join(__dirname, '../events.log');
    
    // Only attempt if the file was mounted correctly
    if (fs.existsSync(logFilePath)) {
      const fileStream = fs.createReadStream(logFilePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      for await (const line of rl) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          await processEvent(event);
        } catch (err) {
          console.error('Error parsing malformed JSON line:', line);
        }
      }

      console.log('Log ingestion completed.');
      
      // 3. Trigger initial reconciliation logic for out-of-order logs
      await reconcileRetryQueue();

    } else {
       console.warn(`events.log not found at ${logFilePath}. Skipping ingestion...`);
    }

    // 4. Expose API Endpoints
    app.listen(PORT, () => {
      console.log(`Router Service listening on port ${PORT}`);
    });

  } catch (error) {
    console.error('Failed to initialize platform:', error);
    process.exit(1);
  }
}

startServer();
