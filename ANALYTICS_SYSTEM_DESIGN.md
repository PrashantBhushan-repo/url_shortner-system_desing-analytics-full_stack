# 🏛️ SnapURL Analytics System Design Reference

This document covers high-level system design patterns, bottleneck mitigations, data layout scaling, and processing optimizations implemented for the analytics and telemetry engine of SnapURL.

---

## 1. Asynchronous Ingestion vs. Write Amplification

In high-throughput shortlink applications, directly inserting click data into a relational database (PostgreSQL) on every redirect creates a critical system bottleneck.

### The Bottleneck: DB Lock Contention & Write Amplification
* Every SQL `INSERT` statement blocks thread execution while waiting for disk write-ahead log (WAL) confirmations.
* Telemetry records are index-heavy (indexed by `url_id`, `clicked_at`, etc.). Each insert forces index tree updates, compounding disk IOPS usage.
* During high traffic spikes, this blocks connection pools and crashes the redirection engine.

### The System Design Solution: Message Queue Decoupling
* **Decoupled Buffer**: The redirect engine converts the click telemetry into a lightweight JSON payload and pushes it to an in-memory Redis List (BullMQ queue). Redis processes operations in RAM, handling `100,000+ operations/sec` at `< 1ms` latency.
* **Worker Throttling**: Background worker processes consume jobs from the queue at a controlled pace. If database load increases, jobs accumulate in Redis memory instead of crashing PostgreSQL.

---

## 2. Cardinality Estimation: Redis HyperLogLog (HLL)

To calculate "Unique Visitors" over a specific timeframe, traditional databases execute query patterns like:
```sql
SELECT COUNT(DISTINCT visitor_id) FROM clicks WHERE url_id = 45;
```

### The Scale Problem:
As clicks scale to millions, `COUNT(DISTINCT)` queries require loading millions of visitor hashes into memory, sorting them, and removing duplicates. This results in heavy CPU usage and query times exceeding several seconds.

### The System Design Solution: HyperLogLog
* **What it is**: HyperLogLog (HLL) is a probabilistic cardinality estimation algorithm.
* **How it works**: HLL estimates the number of unique elements in a set with a maximum standard error of **0.81%**.
* **Memory Optimization**: Rather than storing millions of long string IDs, HLL uses a fixed **12KB of memory** per key, regardless of whether it is tracking 100 uniques or 100,000,000 uniques.
* **Implementation**: The worker calls `PFADD hll:urlId:date visitorId`. The dashboard reads unique visitor counts in `O(1)` time using `PFCOUNT`.

---

## 3. Data Rollups & Aggregations (Preventing Query Latency)

Directly querying the `Click` log table to render a user's dashboard charts (e.g. clicks over the last 30 days) is highly inefficient because it forces a full scan of millions of log rows.

### Aggregation Pipeline Design:
1. **Raw Log Table**: The `Click` table records raw metrics (IP, OS, country, Referrer).
2. **Pre-Aggregated Summary Tables**: The database contains hourly (`UrlStatsHourly`) and daily (`UrlStatsDaily`) summary tables.
3. **Database Upserts**: The background worker registers click details and executes an atomic `UPSERT` on the summary tables:
   ```sql
   INSERT INTO "UrlStatsDaily" (url_id, bucket_date, total_clicks, unique_clicks)
   VALUES ($1, $2, 1, 1)
   ON CONFLICT (url_id, bucket_date) DO UPDATE SET
       total_clicks = "UrlStatsDaily".total_clicks + 1,
       unique_clicks = "UrlStatsDaily".unique_clicks + EXCLUDED.unique_clicks;
   ```
4. **Impact**: The dashboard loads instantly because it queries a pre-aggregated daily row per date instead of millions of click rows.

---

## 4. Horizontal Scaling of WebSockets (Socket.io Redis Adapter)

When a background worker registers a click, it streams the live updates to the user's open dashboard via Socket.io. If the application scales to multiple servers, the worker and the user's dashboard browser session might be connected to different server instances.

```
                  ┌──────────────────────────────┐
                  │   Background Analytics       │
                  │         Worker           │
                  └──────────────┬───────────────┘
                                 │ Live Click Registered
                                 ▼
                  ┌──────────────────────────────┐
                  │     Redis Pub/Sub Adapter    │
                  └──────┬────────────┬──────────┘
                         │            │
            Broadcast to │            │ Broadcast to
            Node 1       ▼            ▼ Node 2
                  ┌──────────┐    ┌──────────┐
                  │ Server 1 │    │ Server 2 │
                  └────┬─────┘    └────┬─────┘
                       │               │ (WebSocket Connection)
                       │               ▼
                       │        ┌──────────────┐
                       │        │ Dashboard A  │
                       ▼        └──────────────┘
                ┌──────────────┐
                │ Dashboard B  │
                └──────────────┘
```

### System Design Solution: Redis Pub/Sub
* The worker emits the update message to the **Redis Pub/Sub Adapter**.
* Redis broadcasts the event to all running Socket.io backend nodes.
* Each backend node inspects its local connection list and pushes the event to users connected to room `url:${urlId}`. This ensures live updates work across autoscaling containers.

---

## 5. Long-Term Data Archiving & Partitioning

As click logs grow indefinitely, the raw `Click` table will eventually degrade database performance due to index sizes exceeding RAM limits.

### Recommended Lifecycle Design:
1. **Database Partitioning**: Partition the PostgreSQL `Click` table by month: `clicks_y2026m08`, `clicks_y2026m09`. Drop or detach old partitions cleanly without locking the main table.
2. **Cold Data Offloading**: Keep pre-aggregated stats (`UrlStatsDaily`) in PostgreSQL indefinitely (as they are small). Move raw click logs older than 90 days out of PostgreSQL into a cold storage bucket (such as AWS S3 or Snowflake) for historical audits.


#### Notes : 

Key System Design Highlights Covered:
1. Asynchronous Ingestion Buffering: Explains the mitigation of database write amplification and lock contention by buffering incoming telemetry inside Redis Lists/BullMQ, shielding PostgreSQL from spike loads.
2. Cardinality Estimation (Redis HyperLogLog): Compares SQL COUNT(DISTINCT) complexity (O(N^2) memory/sort overhead) against Redis HyperLogLog (O(1) speed, standard error of 0.81%, and a fixed 12KB footprint).
3. Database Pre-Aggregations (SQL Upserts): Explains how daily and hourly rollup tables are updated using atomic ON CONFLICT DO UPDATE commands to keep dashboard queries fast.
4. WebSocket Scaling (Redis Pub/Sub): Outlines how the worker broadcasts real-time telemetry updates across multiple auto-scaled backend instances using the Redis Socket.io Adapter.
5. Data Retention & Partitioning: Strategies for handling tables with billions of rows (PostgreSQL partitioning by date range and offloading cold logs to S3).
