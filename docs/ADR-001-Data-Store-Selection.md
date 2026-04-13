# ADR-001: Data Store Selection for the Logistics Platform

### Context
Our logistics platform needs to serve three fundamentally different query patterns simultaneously in a performant manner:
1. **Geospatial and Graph Processing**: Matching dynamic driver relationships with shifting operational zones.
2. **Historical Document Logging**: Appending infinite, unstructured or semi-structured state changes of packages without complex scheme migrations.
3. **Financial Transaction Records**: Storing final billing records requiring robust ACID compliance, atomicity, and strong duplicate indexing.

Trying to force all three use cases into a single database system would either cripple performance, result in a brittle data schema, or force us to implement difficult client-side logic to replicate missing native tooling. 

### Decision
We have decided to apply Polyglot Persistence:
- **Neo4j (Graph Database)**: Will be used for driver-zone spatial and structural mapping logic.
- **MongoDB (Document Database)**: Will be used for preserving package chronological histories.
- **PostgreSQL (Relational Database)**: Will be used for executing the billing invoices ledger.

### Consequences

**Neo4j (Graph Database)**
- **Pros**: Outstanding querying relationships like pathfinding, graph logic (e.g. `MATCH (d)-[:LOCATED_IN]->(z)`). It natively clusters drivers in zones perfectly.
- **Cons**: Overkill for appending simple JSON documents, and suboptimal for large transactional financial records.

**MongoDB (Document Database)**
- **Pros**: Unstructured schema allows package status metadata (GPS variables, text, random arrays) to expand freely. The `$push` mechanic simplifies constructing event histories iteratively.
- **Cons**: Eventual consistency and lack of full ACID guarantees making it unsafe for our financial invoice storage.

**PostgreSQL (Relational Database)**
- **Pros**: True relational table locks ensuring transactional integrity for our billing pipeline. Features strong UNIQUE constraint capabilities guaranteeing atomicity.
- **Cons**: Rigid structures make handling deep nested object relationships natively cumbersome compared to NoSQL.

**Overall System Complexity (Polyglot Persistence Integration)**
- Adopting Polyglot Persistence dramatically increases our operational surface area (maintaining 3x database images, drivers, and network subnets) and enforces us to architect an "Eventual Consistency" framework (`retry_queue.json`) to gracefully recover decoupled microservice pipeline failures. However, the tailored speed of each query outweighs these drawbacks for our architecture.
