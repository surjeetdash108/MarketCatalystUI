/**
 * Rich text for Market Catalyst Pulse posts.
 *
 * Posts are stored as plain text with a few simple markers, so older posts
 * (written before the formatting toolbar) read correctly too:
 *
 *   **bold**   *italic*   [label](https://…)   bare https://… links
 *   "* " / "- " / "• " at the start of a line → bullet list
 *   "1. " / "1) " at the start of a line      → numbered list
 *   a blank line                              → new paragraph
 *   a single line break                       → line break
 *
 * Kept pure (no React) so the parsing is testable; the admin console has a
 * copy of the same rules for its preview.
 */

export type PulseInline =
  | { k: "text"; t: string }
  | { k: "b"; c: PulseInline[] }
  | { k: "i"; c: PulseInline[] }
  | { k: "link"; href: string; c: PulseInline[] };

export type PulseBlock =
  | { k: "p"; lines: PulseInline[][] }
  | { k: "ul" | "ol"; items: PulseInline[][] };

const BULLET = /^\s*[*\-•]\s+(.*)$/;
const NUMBERED = /^\s*\d{1,3}[.)]\s+(.*)$/;

/** Only web links are made clickable; anything else stays text. */
function safeHref(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

// One pass over the line: **bold**, [label](url), bare url, *italic*. The
// italic markers must hug the text ("*word*", not "a * b"), so a stray
// asterisk in prose is left alone.
const INLINE = /\*\*(.+?)\*\*|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]*[^\s<.,;:!?)\]'"])|\*(?=\S)(.+?)(?<=\S)\*/g;

export function parsePulseInline(text: string): PulseInline[] {
  const out: PulseInline[] = [];
  let last = 0;
  const push = (t: string) => {
    if (!t) return;
    const prev = out[out.length - 1];
    if (prev && prev.k === "text") prev.t += t;
    else out.push({ k: "text", t });
  };
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    push(text.slice(last, at));
    last = at + m[0].length;
    if (m[1] != null) out.push({ k: "b", c: parsePulseInline(m[1]) });
    else if (m[2] != null) {
      const href = safeHref(m[3]);
      if (href) out.push({ k: "link", href, c: parsePulseInline(m[2]) });
      else push(m[0]);
    } else if (m[4] != null) {
      const href = safeHref(m[4]);
      if (href) out.push({ k: "link", href, c: [{ k: "text", t: m[4] }] });
      else push(m[0]);
    } else if (m[5] != null) out.push({ k: "i", c: parsePulseInline(m[5]) });
  }
  push(text.slice(last));
  return out;
}

export function parsePulse(text: string): PulseBlock[] {
  const blocks: PulseBlock[] = [];
  let cur: PulseBlock | null = null;
  const close = () => {
    if (cur) blocks.push(cur);
    cur = null;
  };
  for (const raw of (text ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      close();
      continue;
    }
    const b = BULLET.exec(line);
    const n = b ? null : NUMBERED.exec(line);
    const kind = b ? "ul" : n ? "ol" : "p";
    const body = b ? b[1] : n ? n[1] : line.trim();
    if (!cur || cur.k !== kind) {
      close();
      cur = kind === "p" ? { k: "p", lines: [] } : { k: kind, items: [] };
    }
    const inl = parsePulseInline(body);
    if (cur.k === "p") cur.lines.push(inl);
    else cur.items.push(inl);
  }
  close();
  return blocks;
}

function inlineText(c: PulseInline[]): string {
  return c.map(x => (x.k === "text" ? x.t : inlineText(x.c))).join("");
}

/** The words a reader sees (markers and hidden link targets removed), for search counts. */
export function pulsePlainText(text: string): string {
  return parsePulse(text)
    .map(b => (b.k === "p" ? b.lines : b.items).map(inlineText).join("\n"))
    .join("\n\n");
}
