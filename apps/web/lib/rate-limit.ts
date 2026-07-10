const buckets = new Map<string, number[]>();

export function hitRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const since = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((ts) => ts > since);
  hits.push(now);
  buckets.set(key, hits);
  return hits.length > limit;
}
