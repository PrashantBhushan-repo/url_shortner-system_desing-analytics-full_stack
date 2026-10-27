export const CHART_COLORS = ['#2d9a5f','#6c63e0','#f59e42','#3b82f6','#ec4899','#10b981','#f43f5e','#8b5cf6'];

export function pieBreakdown(values = [], nameKey = 'name') {
  const grouped = new Map();
  for (const item of values) {
    const value = Number(item.count);
    if (!Number.isFinite(value) || value <= 0) continue;
    const name = String(item[nameKey] || 'Unknown');
    grouped.set(name, (grouped.get(name) || 0) + value);
  }
  const sorted = [...grouped].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const slices = sorted.length > 6 ? [...sorted.slice(0, 5), { name: 'Remaining categories', value: sorted.slice(5).reduce((sum, item) => sum + item.value, 0) }] : sorted;
  return { total: sorted.reduce((sum, item) => sum + item.value, 0), slices: slices.map((item, index) => ({ ...item, color: CHART_COLORS[index] })) };
}
