import '../src/config/config.js';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '../src/generated/prisma/index.js';

const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { stdio: 'inherit', env: process.env });
if (result.status !== 0) process.exit(result.status || 1);
const prisma = new PrismaClient();
let empty;
try { empty = await prisma.plan.count() === 0; }
finally { await prisma.$disconnect(); }
// Bootstrap plans only for an empty installation, never overwrite live pricing.
if (empty) {
  const seeded = spawnSync(process.execPath, ['prisma/seed.js'], { stdio: 'inherit', env: process.env });
  if (seeded.status !== 0) process.exit(seeded.status || 1);
}
