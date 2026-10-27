export function analyticsWindow(range = "7d", cutoff = null, now = new Date()) {
  const duration = ({ "24h": 86400000, "7d": 604800000, "30d": 2592000000 })[range] ?? 604800000;
  const end = new Date(now);
  const start = new Date(Math.max(end.getTime() - duration, cutoff ? new Date(cutoff).getTime() : 0));
  return { start, end };
}

export function fillTimeBuckets(rows, range, start, end) {
  const hourly = range === "24h";
  const step = hourly ? 3600000 : 86400000;
  const floor = value => Math.floor(new Date(value).getTime() / step) * step;
  const byBucket = new Map(rows.map(row => [floor(row.bucket), row]));
  const result = [];
  for (let time = floor(start); time <= floor(end); time += step) {
    const row = byBucket.get(time);
    result.push({ timestamp: new Date(time).toISOString(), label: hourly ? new Date(time).toISOString().slice(11,16) : new Date(time).toISOString().slice(5,10), clicks: Number(row?.clicks || 0), unique: Number(row?.unique || 0), bots: Number(row?.bots || 0) });
  }
  return result;
}
