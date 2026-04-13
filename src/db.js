const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const neo4j = require('neo4j-driver');

// PostgreSQL Connection
const pgPool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  host: process.env.POSTGRES_HOST || 'postgres',
  database: process.env.POSTGRES_DB || 'logistics',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
});

async function initPostgres() {
  const client = await pgPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        invoice_id VARCHAR(255) PRIMARY KEY,
        package_id VARCHAR(255) NOT NULL,
        customer_id VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('PostgreSQL initialized.');
  } finally {
    client.release();
  }
}

// MongoDB Connection
const mongoUri = process.env.MONGO_URI || 'mongodb://mongo:27017';
const mongoClient = new MongoClient(mongoUri);
let db;

async function initMongo() {
  await mongoClient.connect();
  db = mongoClient.db(process.env.MONGO_DB || 'logistics');
  console.log('MongoDB initialized.');
}

function getMongoDb() {
  return db;
}

// Neo4j Connection
const neo4jUri = process.env.NEO4J_URI || 'neo4j://neo4j:7687';
const neo4jUser = process.env.NEO4J_USER || 'neo4j';
const neo4jPassword = process.env.NEO4J_PASSWORD || 'password';

const neo4jDriver = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPassword));

async function initNeo4j() {
  await neo4jDriver.getServerInfo();
  console.log('Neo4j initialized.');
}

module.exports = {
  pgPool,
  initPostgres,
  mongoClient,
  initMongo,
  getMongoDb,
  neo4jDriver,
  initNeo4j
};
