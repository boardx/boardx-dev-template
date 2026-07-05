export function nowIso(): string {
  return new Date().toISOString();
}

export function secondsSince(iso: string, referenceNowIso?: string): number {
  const reference = referenceNowIso ? new Date(referenceNowIso).getTime() : Date.now();
  return (reference - new Date(iso).getTime()) / 1000;
}

export function isExpired(lastHeartbeatAt: string, ttlSeconds: number, referenceNowIso?: string): boolean {
  return secondsSince(lastHeartbeatAt, referenceNowIso) > ttlSeconds;
}
