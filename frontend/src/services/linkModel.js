export function normalizeLink(item) {
  return { ...item, id: String(item.id), shortCode: item.shortCode ?? item.short_code, shortUrl: item.shortUrl ?? item.short_url ?? "", longUrl: item.longUrl ?? item.long_url ?? "", isActive: item.isActive ?? item.is_active ?? true, expiresAt: item.expiresAt ?? item.expires_at ?? null, createdAt: item.createdAt ?? item.created_at ?? null, clicksCount: Number(item.clicksCount ?? item.clicks_count ?? 0), lastCheckedAt: item.lastCheckedAt ?? item.last_checked_at ?? null, isAlive: item.isAlive ?? item.is_alive ?? null };
}
export function linkStatus(link, now = Date.now()) {
  if (!link.isActive) return "Archived";
  if (link.expiresAt && new Date(link.expiresAt).getTime() <= now) return "Expired";
  return "Active";
}
export function upsertLink(links, updated) {
  const link = normalizeLink(updated);
  return [link, ...links.filter(item => item.id !== link.id)].sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}
export function visibleLinks(links, query, status, sort = "newest") {
  const search = query.trim().toLowerCase();
  const filtered = links.filter(link => (status === "All" || linkStatus(link) === status) && [link.shortCode,link.shortUrl,link.longUrl].some(value => String(value || "").toLowerCase().includes(search)));
  return filtered.sort((a,b) => sort === "clicks" ? b.clicksCount-a.clicksCount : sort === "oldest" ? new Date(a.createdAt)-new Date(b.createdAt) : new Date(b.createdAt)-new Date(a.createdAt));
}

export function trackedQrUrl(value) { const url = new URL(value); url.searchParams.set('src','qr'); return url.href; }
export function localDateTime(value) { if (!value) return ''; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset()*60000).toISOString().slice(0,16); }
