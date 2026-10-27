import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

try {
  if (process.argv.includes('--worker')) {
    const modified = fs.statSync(path.join(os.tmpdir(), 'pburls-worker-ready')).mtimeMs;
    if (Date.now() - modified > 45000) throw new Error('Worker heartbeat is stale');
  } else {
    const response = await fetch(`http://127.0.0.1:${process.env.PORT || 5000}/ready`, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error('Backend is not ready');
  }
} catch { process.exitCode = 1; }
