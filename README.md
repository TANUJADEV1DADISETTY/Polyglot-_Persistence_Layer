# 🚚 Polyglot Persistence Layer for Real-Time Logistics Platform

## 📌 Project Overview

This project demonstrates a **Polyglot Persistence Architecture** for a real-time logistics platform.  
Instead of using a single database, the system leverages **multiple databases**, each optimized for a specific use case:

- 📊 Relational Database → Billing & transactions
- 📄 Document Database → Package history tracking
- 🕸️ Graph Database → Driver-zone relationships

The system ingests events from a log file, processes them, ensures **eventual consistency**, and exposes a **unified API** for querying combined data.

---

## 🎯 Objective

- Build an event-driven backend system
- Implement polyglot persistence
- Handle out-of-order events using retry queue
- Provide a unified API
- Fully containerize using Docker Compose

---

## 🏗️ System Architecture

events.log → Event Router →  
 ├── MongoDB (Package History)  
 ├── Neo4j (Driver ↔ Zone Graph)  
 └── PostgreSQL (Billing)  
 ↑  
 Retry Queue  
 ↑  
 Reconciliation Process  
 ↓  
 Unified API

---

## 🧰 Tech Stack

| Layer            | Technology              |
| ---------------- | ----------------------- |
| Backend          | Node.js (Express)       |
| Relational DB    | PostgreSQL              |
| Document DB      | MongoDB                 |
| Graph DB         | Neo4j                   |
| Containerization | Docker + Docker Compose |

---

## 📁 Project Structure

polyglot-logistics/  
│  
├── docker-compose.yml  
├── .env.example  
├── events.log  
├── retry_queue.json  
│  
├── app/  
│ ├── Dockerfile  
│ ├── package.json  
│ ├── index.js  
│ │  
│ ├── db/  
│ │ ├── mongo.js  
│ │ ├── postgres.js  
│ │ ├── neo4j.js  
│ │  
│ ├── handlers/  
│ │ ├── driverHandler.js  
│ │ ├── packageHandler.js  
│ │ ├── billingHandler.js  
│ │  
│ ├── services/  
│ │ ├── eventProcessor.js  
│ │ ├── retryService.js  
│ │  
│ └── routes/  
│ └── query.js  
│  
├── docs/  
│ └── ADR-001-Data-Store-Selection.md  
│  
└── README.md

---

## ⚙️ Setup Instructions

### 🔹 Prerequisites

- Docker installed
- Docker Compose installed

---

### 🔹 Step 1: Clone Repository

git clone <your-repo-url>  
cd polyglot-logistics

---

### 🔹 Step 2: Setup Environment Variables

Create .env file using .env.example

POSTGRES_USER=user  
POSTGRES_PASSWORD=password  
POSTGRES_DB=logistics

MONGO_URI=mongodb://mongo:27017/logistics

NEO4J_URI=bolt://neo4j:7687  
NEO4J_USER=neo4j  
NEO4J_PASSWORD=password

---

### 🔹 Step 3: Run Application

docker-compose up --build

---

### 🔹 Step 4: Verify Services

- PostgreSQL → localhost:5432
- MongoDB → localhost:27017
- Neo4j → http://localhost:7474
- API → http://localhost:3000

---

## 📥 Event Ingestion

- The application automatically reads events.log on startup
- Each line is parsed as JSON
- Invalid JSON lines are skipped with error logging

---

## 🔄 Event Types

1. DRIVER_LOCATION_UPDATE
   - Stored in Neo4j
   - Creates Driver → Zone relationship

2. PACKAGE_STATUS_CHANGE
   - Stored in MongoDB
   - Appended to status_history

3. BILLING_EVENT
   - Stored in PostgreSQL
   - Only if package is DELIVERED

---

## ⚠️ Eventual Consistency

- If billing event comes before delivery → added to retry_queue.json
- Reconciliation process retries later
- Ensures eventual consistency

---

## 🔁 Retry Queue

- File: retry_queue.json
- Stores deferred billing events
- Automatically reprocessed after ingestion

---

## 🌐 API Endpoint

GET /query/package/:package_id

---

## 📤 Sample API Response

[
{
"source_system": "document_store",
"timestamp": "2023-10-27T10:00:00Z",
"event_details": {
"status": "PICKED_UP"
}
},
{
"source_system": "relational_store",
"timestamp": "2023-10-27T10:20:00Z",
"event_details": {
"amount": 100
}
}
]

---

## 🧪 Testing Checklist

- docker-compose up runs successfully
- events.log processed correctly
- invalid JSON handled
- MongoDB stores package history
- Neo4j stores driver relationships
- PostgreSQL stores billing data
- duplicate billing prevented
- retry queue works
- API returns sorted results

---

## 📘 Architecture Decision Record

Location: docs/ADR-001-Data-Store-Selection.md

### Context

Different data patterns require different databases

### Decision

- Graph DB → Neo4j
- Document DB → MongoDB
- Relational DB → PostgreSQL

### Consequences

Pros:

- Optimized queries
- Scalability
- Flexibility

Cons:

- Increased complexity
- Eventual consistency required

---

## 🚀 Future Improvements

- Kafka for real-time streaming
- Redis caching
- Authentication layer
- Microservices architecture

---

## 👨‍💻 Author

Your Name

---

## 📜 License

This project is for educational purposes.
