import { databaseDuration, pgPoolConnections } from './metrics.js';
export const databaseOperation = query => {
  const first = String(query || '').trimStart().split(/\s+/, 1)[0].toUpperCase();
  return ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'WITH'].includes(first) ? first : 'OTHER';
};
export const observePrismaQuery = event => databaseDuration.observe({ client: 'prisma', operation: databaseOperation(event.query) }, event.duration / 1000);
export const instrumentPool = pool => {
  const query = pool.query.bind(pool);
  pool.query = (...args) => {
    const started = process.hrtime.bigint();
    const labels = { client: 'pg', operation: databaseOperation(typeof args[0] === 'string' ? args[0] : args[0]?.text) };
    const done = () => databaseDuration.observe(labels, Number(process.hrtime.bigint() - started) / 1e9);
    if (typeof args.at(-1) === 'function') {
      const callback = args.pop();
      args.push((...result) => { done(); callback(...result); });
      return query(...args);
    }
    return query(...args).finally(done);
  };
  pgPoolConnections.collect = function () {
    this.set({ state: 'total' }, pool.totalCount);
    this.set({ state: 'idle' }, pool.idleCount);
    this.set({ state: 'waiting' }, pool.waitingCount);
  };
  return pool;
};
