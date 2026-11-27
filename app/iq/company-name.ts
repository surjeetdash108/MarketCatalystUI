/**
 * A company with no name synced falls back to its ticker in several screens, which
 * printed the ticker twice: once as the title, once as its own "name". The name is
 * worth showing only when it is something other than the ticker.
 */
export function hasCompanyName(name: string | null | undefined, ticker: string): boolean {
  const n = (name ?? "").trim();
  return n !== "" && n.toUpperCase() !== ticker.trim().toUpperCase();
}
