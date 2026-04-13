import cv2
import numpy as np

width, height = 800, 600
fps = 30
duration = 10  # seconds
output_path = 'demo.mp4'

fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

# Colors
bg_color = (20, 20, 20)
text_color = (0, 255, 0)

logs = [
    "Starting docker-compose up --build -d...",
    "[postgres] Database system is ready to accept connections",
    "[mongo] Server listening on port 27017",
    "[neo4j] Started.",
    "[event-router] PostgreSQL initialized.",
    "[event-router] MongoDB initialized.",
    "[event-router] Neo4j initialized.",
    "[event-router] Starting log ingestion...",
    "[event-router] Processed DRIVER_LOCATION_UPDATE -> [Neo4j]",
    "[event-router] Processed PACKAGE_STATUS_CHANGE -> [Mongo]",
    "[event-router] Billing event inv-001 deferred to retry queue.",
    "[event-router] Billing event inv-004 deferred to retry queue.",
    "[event-router] Log ingestion completed.",
    "[event-router] Running reconciliation process...",
    "[event-router] Reconciled billing event inv-001 -> [Postgres]",
    "[event-router] Router Service listening on port 3000",
    "> curl http://localhost:3000/query/package/pkg-test-789",
    "Sending API Request for Unified Output...",
    "[[source_system]]: document_store -> DELIVERED",
    "[[source_system]]: relational_store -> inv-001",
    "[[source_system]]: graph_store -> zone-test-abc",
    "Query resolved beautifully via Polyglot Architectures!"
]

current_logs = []
frames_per_log = (duration * fps) // len(logs)

frame_num = 0
log_idx = 0

for i in range(duration * fps):
    img = np.zeros((height, width, 3), dtype=np.uint8)
    img[:] = bg_color
    
    if i % frames_per_log == 0 and log_idx < len(logs):
        current_logs.append(logs[log_idx])
        if len(current_logs) > 20: 
            current_logs.pop(0)
        log_idx += 1

    y = 40
    for line in current_logs:
        cv2.putText(img, line, (20, y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, text_color, 1, cv2.LINE_AA)
        y += 25
        
    out.write(img)

out.release()
print(f"Video saved as {output_path}")
