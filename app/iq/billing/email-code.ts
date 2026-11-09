/** Digits only, at most 6 (paste-friendly: "123 456" → "123456"). */
export function sanitizeCode(raw: string): string {
  return String(raw ?? "").replace(/\D/g, "").slice(0, 6);
}

/** Only same-site paths are followed after verification ("/x", never "//host" or a URL). */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  const n = String(next ?? "");
  return n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") ? n : fallback;
}
