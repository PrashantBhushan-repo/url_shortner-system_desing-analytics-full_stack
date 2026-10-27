export async function checkReadiness({ database, redis, timeoutMs = 2500 }) {
  let timer;
  try {
    await Promise.race([
      Promise.all([database(), redis()]),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Readiness timeout')), timeoutMs); }),
    ]);
    return true;
  } catch { return false; }
  finally { clearTimeout(timer); }
}
