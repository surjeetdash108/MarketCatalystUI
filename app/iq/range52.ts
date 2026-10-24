/**
 * The 52-week high / low every screen shows: the stored range (backend
 * technical-indicators — built from completed daily bars, structural breaks
 * trimmed), widened by today's session high / low from the live quote. The
 * stored range ends at the last synced bar, so a new high made today was
 * missing (QLYS 217.64 vs 219.03), and the stock page and Stock Intelligence
 * each used a different base (REPX 53.81 vs 54.18). One rule for both.
 */
export function range52(
  stored: { high: number | null | undefined; low: number | null | undefined },
  session: { high: number | null | undefined; low: number | null | undefined },
): { high: number | null; low: number | null } {
  const pos = (v: number | null | undefined) => (v != null && Number.isFinite(v) && v > 0 ? v : null);
  const sh = pos(stored.high), sl = pos(stored.low), dh = pos(session.high), dl = pos(session.low);
  return {
    high: sh != null && dh != null ? Math.max(sh, dh) : sh ?? null,
    low: sl != null && dl != null ? Math.min(sl, dl) : sl ?? null,
  };
}
