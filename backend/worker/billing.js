import { startBillingRecovery } from '../src/services/billingRecovery.js';
import prisma from '../src/config/prismaClient.js';

const stop = startBillingRecovery();
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => {
  stop();
  await prisma.$disconnect();
  process.exit(0);
});
