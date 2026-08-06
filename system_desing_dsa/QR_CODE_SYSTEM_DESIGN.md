# 🏁 SnapURL QR Code Engine: System Design & DSA Reference

This document covers the end-to-end workflow, mathematical designs, system scaling architectures, and algorithms (DSA) applied to generate, render, and track QR Code interactions in SnapURL.

---

## 1. End-to-End Workflow Diagram

The system handles QR Codes in two separate pipelines: **Generation** (creating the code) and **Ingestion** (tracking scans).

```
   [ GENERATION PIPELINE - GET /api/urls/:shortCode/qr ]
  ┌──────────────┐                  ┌──────────────┐
  │ React Client │◄── [Base64 PNG] ─┤ Backend API  │
  └──────┬───────┘                  └──────┬───────┘
         │ (Render image)                  │ 1. Fetch shortUrl path
         ▼                                 ▼
   ┌───────────┐                    ┌──────────────┐
   │ <img> Tag │                    │  QRCode Lib  │ (Base64 Encoder)
   └───────────┘                    └──────────────┘


   [ INGESTION PIPELINE - SCANNING FLOW ]
  ┌──────────────┐
  │ Mobile Phone │ (Scans Code)
  └──────┬───────┘
         │ Hits: http://snapurl.com/r/abc123?qr=true
         ▼
  ┌──────────────────────┐
  │ Express Redirector   │ ──► Enqueues Telemetry Job (isQrScan: true)
  └──────┬───────────────┘
         │ (HTTP 302 Found)
         ▼
  ┌──────────────────────┐
  │   Destination URL    │
  └──────────────────────┘
```

---

## 2. DSA: QR Code Structure & Error Correction

Under the hood, QR (Quick Response) codes rely on discrete data grids and polynomial error-checking math.

### A. Reed-Solomon Error Correction (Algebraic DSA)
QR codes can survive physical damage (scratches, dirt, or logo overlays) because they employ **Reed-Solomon Error Correction**:
* **The Math**: Data is treated as coefficients of a polynomial over a Galois Field (\(GF(2^8)\)). Extra check-character polynomials are appended to the data blocks.
* **Error Correction Levels (ECC)**:
  * **Level L (Low)**: Recovers up to **7%** damage.
  * **Level M (Medium)**: Recovers up to **15%** damage (Standard).
  * **Level Q (Quarter)**: Recovers up to **25%** damage.
  * **Level H (High)**: Recovers up to **30%** damage (Necessary if overlaying a custom brand logo in the center of the QR).

### B. Matrix Grid Mapping
The QR code is rendered as a binary 2D grid matrix of modules (black = `1`, white = `0`):
1. **Finder Patterns**: The three distinctive squares in the corners allow scanners to establish grid alignment and orientation, regardless of rotation angle.
2. **Alignment & Timing Patterns**: Fine-tunes grid mapping to correct for curved surfaces (like scans from physical posters).
3. **Data Area**: The remaining modules contain the encoded URL payload byte stream, masked with a mathematical XOR grid filter to prevent large solid blocks of black/white (which confuse scanner sensors).

---

## 3. System Design: Compute vs. Storage Trade-offs

When designing a QR code feature for a SaaS dashboard, system architects face a critical engineering choice: **Generate on-the-fly (CPU-Bound)** vs. **Pre-render and Store (Storage-Bound)**.

| Strategy | Compute On-the-Fly (Implemented) | Pre-render & Store (S3 Bucket) |
| :--- | :--- | :--- |
| **Storage Overhead** | **Zero** (Base64 string is computed and streamed in the API response memory, saving DB and disk space). | **High** (Storing millions of PNG/SVG image assets generates substantial storage costs). |
| **Latency Cost** | **Low-Medium** (QR generation takes `5ms - 15ms` of CPU cycles per request). | **Low** (Serving static files from a CDN takes `< 2ms`). |
| **Dynamic Domains** | **Seamless** (If a user maps a custom domain, the generated QR instantly encodes the new domain name). | **Complex** (Requires invalidating and re-rendering stored image files). |

### Optimization & Caching Strategy:
Because SnapURL implements **On-the-Fly Generation**, standard clients caching handles the load:
* **HTTP Cache Control**: Responses are served with `Cache-Control: public, max-age=86400` headers. The visitor's browser or CDNs cache the QR base64 response, avoiding CPU usage on repeat lookups.

---

## 4. Telemetry Split: Tracking QR Clicks

A primary feature of SaaS analytics is letting customers see: *"How many people scanned my physical flyer (QR) vs. clicked my social media post (Shortlink)?"*

### Implementation Workflow:
1. **Embedding**: When generating the QR code payload, the system encodes the short link with a query flag:
   `http://snapurl.com/r/abc123?qr=true`
2. **Detection**: In `url.controller.js` on incoming redirect requests:
   ```javascript
   const isQrScan = req.query.qr === "true";
   ```
3. **Queue Passing**: The `isQrScan` Boolean is enqueued inside the click telemetry payload.
4. **Aggregation**: The worker writes `isQrScan` to the SQL `Click` log table and increments `total_clicks` under daily analytics.
5. **Dashboard Filtering**: Users can filter analytics charts by `is_qr_scan = true` to display real-time QR scanner metrics.
