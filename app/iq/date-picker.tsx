"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Themed date picker — replaces the browser's native <input type="date">, whose
 * calendar popup cannot be styled and looks different in every browser.
 *
 * Values are plain "YYYY-MM-DD" strings. All date math runs in UTC on those
 * strings, so a user's timezone or a DST change can never shift the chosen day.
 *
 * The popup is portalled into the app's `.iq-root` (where the theme CSS
 * variables live) with fixed positioning, so it is never clipped by a scrolling
 * dialog body and always matches the active light/dark theme.
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = MONTHS.map(m => m.slice(0, 3));
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const POPUP_W = 296;
const POPUP_H = 356;

type View = "days" | "months" | "years";

function toIso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}
function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m - 1, d];
}
function addDays(iso: string, n: number): string {
  const [y, m, d] = parts(iso);
  return toIso(y, m, d + n);
}
/** Same day-of-month n months away, clamped to that month's last day. */
function addMonths(iso: string, n: number): string {
  const [y, m, d] = parts(iso);
  const last = new Date(Date.UTC(y, m + n + 1, 0)).getUTCDate();
  return toIso(y, m + n, Math.min(d, last));
}
function localToday(): string {
  const t = new Date();
  return toIso(t.getFullYear(), t.getMonth(), t.getDate());
}
/** "Sep 29, 2026" — formatted in UTC so the stored day is the shown day. */
export function formatDisplayDate(iso: string): string {
  const [y, m, d] = parts(iso);
  return `${MONTHS_SHORT[m]} ${d}, ${y}`;
}
function clamp(iso: string, min: string, max: string): string {
  return iso < min ? min : iso > max ? max : iso;
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
      <path d="M3 9.5h18M8 3v3M16 3v3" />
    </svg>
  );
}
function Chevron({ dir }: { dir: "left" | "right" | "down" }) {
  const d = dir === "left" ? "M15 6l-6 6 6 6" : dir === "right" ? "M9 6l6 6-6 6" : "M6 9l6 6 6-6";
  return (
    <svg width={dir === "down" ? 12 : 16} height={dir === "down" ? 12 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function DatePicker({
  id,
  value,
  onChange,
  min = "1900-01-01",
  max,
  invalid = false,
  placeholder = "Select a date",
  allowClear = false,
}: {
  id?: string;
  /** "YYYY-MM-DD", or "" for no date. */
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  /** Latest selectable date, "YYYY-MM-DD". Defaults to no limit. */
  max?: string;
  invalid?: boolean;
  placeholder?: string;
  allowClear?: boolean;
}) {
  const today = localToday();
  const maxDate = max ?? "9999-12-31";
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("days");
  // The day the keyboard cursor is on; also decides which month is shown.
  const [cursor, setCursor] = useState(() => clamp(value || today, min, maxDate));
  // First year of the 12-year page in the years view.
  const [yearPage, setYearPage] = useState(() => parts(value || today)[0] - 7);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [portalRoot, setPortalRoot] = useState<Element | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const focusCursorRef = useRef(false);

  const [cy, cm] = parts(cursor);

  const place = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const top = below < POPUP_H + 12 && r.top > below ? r.top - POPUP_H - 6 : r.bottom + 6;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - POPUP_W - 8));
    setPos({ top, left });
  }, []);

  function openPicker() {
    const start = clamp(value || today, min, maxDate);
    setCursor(start);
    setYearPage(parts(start)[0] - 7);
    setView("days");
    setPortalRoot(triggerRef.current?.closest(".iq-root") ?? document.body);
    place();
    focusCursorRef.current = true;
    setOpen(true);
  }

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  function select(iso: string) {
    onChange(iso);
    close(true);
  }

  // Keep the popup attached to its field while anything scrolls or resizes.
  useLayoutEffect(() => {
    if (!open) return;
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  // Outside click closes without changing the value.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (popupRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);

  // Escape works even when focus has dropped to <body> — e.g. after switching
  // to the month/year view re-renders the button that was clicked. Captured so
  // it closes only the picker, not a dialog underneath that listens for Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      if (view === "days") close(true);
      else setView(view === "years" ? "months" : "days");
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, view, close]);

  // Move real focus onto the cursor day after keyboard navigation.
  useEffect(() => {
    if (!open || view !== "days" || !focusCursorRef.current) return;
    focusCursorRef.current = false;
    popupRef.current?.querySelector<HTMLButtonElement>(`[data-day="${cursor}"]`)?.focus();
  }, [open, view, cursor]);

  function moveCursor(iso: string) {
    focusCursorRef.current = true;
    setCursor(clamp(iso, min, maxDate));
  }

  function onGridKey(e: React.KeyboardEvent) {
    const keys: Record<string, () => string> = {
      ArrowLeft: () => addDays(cursor, -1),
      ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -7),
      ArrowDown: () => addDays(cursor, 7),
      PageUp: () => addMonths(cursor, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(cursor, e.shiftKey ? 12 : 1),
      Home: () => addDays(cursor, -new Date(`${cursor}T00:00:00Z`).getUTCDay()),
      End: () => addDays(cursor, 6 - new Date(`${cursor}T00:00:00Z`).getUTCDay()),
    };
    if (keys[e.key]) {
      e.preventDefault();
      moveCursor(keys[e.key]());
    }
  }

  // ── Day grid: 6 weeks starting on the Sunday on/before the 1st ──
  const firstDow = new Date(Date.UTC(cy, cm, 1)).getUTCDay();
  const gridStart = toIso(cy, cm, 1 - firstDow);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const prevMonthOk = toIso(cy, cm, 0) >= min;
  const nextMonthOk = toIso(cy, cm + 1, 1) <= maxDate;
  const minYear = parts(min)[0];
  const maxYear = parts(maxDate)[0];

  const popup = open && pos && portalRoot && createPortal(
    <div
      ref={popupRef}
      className="dp-pop"
      role="dialog"
      aria-modal="false"
      aria-label="Choose date"
      style={{ top: pos.top, left: pos.left, width: POPUP_W }}
    >
      {view === "days" && (
        <>
          <div className="dp-head">
            <button type="button" className="dp-nav" onClick={() => setCursor(addMonths(cursor, -1))} disabled={!prevMonthOk} aria-label="Previous month"><Chevron dir="left" /></button>
            <button type="button" className="dp-title" onClick={() => setView("months")} aria-label={`${MONTHS[cm]} ${cy}, change month or year`}>
              {MONTHS[cm]} {cy} <Chevron dir="down" />
            </button>
            <button type="button" className="dp-nav" onClick={() => setCursor(addMonths(cursor, 1))} disabled={!nextMonthOk} aria-label="Next month"><Chevron dir="right" /></button>
          </div>
          <div className="dp-grid" role="grid" onKeyDown={onGridKey}>
            {WEEKDAYS.map(w => <div key={w} className="dp-dow" role="columnheader">{w}</div>)}
            {days.map(iso => {
              const [, dm, dd] = parts(iso);
              const disabled = iso < min || iso > maxDate;
              const cls = [
                "dp-day",
                dm !== cm && "out",
                iso === today && "today",
                iso === value && "sel",
              ].filter(Boolean).join(" ");
              return (
                <button
                  key={iso}
                  type="button"
                  role="gridcell"
                  data-day={iso}
                  className={cls}
                  disabled={disabled}
                  tabIndex={iso === cursor ? 0 : -1}
                  aria-selected={iso === value}
                  aria-label={formatDisplayDate(iso)}
                  onClick={() => select(iso)}
                >{dd}</button>
              );
            })}
          </div>
        </>
      )}

      {view === "months" && (
        <>
          <div className="dp-head">
            <button type="button" className="dp-nav" onClick={() => setCursor(addMonths(cursor, -12))} disabled={cy - 1 < minYear} aria-label="Previous year"><Chevron dir="left" /></button>
            <button type="button" className="dp-title" onClick={() => { setYearPage(cy - 7); setView("years"); }} aria-label={`${cy}, change year`}>
              {cy} <Chevron dir="down" />
            </button>
            <button type="button" className="dp-nav" onClick={() => setCursor(clamp(addMonths(cursor, 12), min, maxDate))} disabled={cy + 1 > maxYear} aria-label="Next year"><Chevron dir="right" /></button>
          </div>
          <div className="dp-cells">
            {MONTHS_SHORT.map((label, m) => {
              const disabled = toIso(cy, m, 1) > maxDate || toIso(cy, m + 1, 0) < min;
              return (
                <button
                  key={label}
                  type="button"
                  className={`dp-cell${m === cm ? " sel" : ""}`}
                  disabled={disabled}
                  onClick={() => { setCursor(clamp(addMonths(cursor, m - cm), min, maxDate)); focusCursorRef.current = true; setView("days"); }}
                >{label}</button>
              );
            })}
          </div>
        </>
      )}

      {view === "years" && (
        <>
          <div className="dp-head">
            <button type="button" className="dp-nav" onClick={() => setYearPage(yearPage - 12)} disabled={yearPage <= minYear} aria-label="Earlier years"><Chevron dir="left" /></button>
            <div className="dp-title static">{yearPage} – {yearPage + 11}</div>
            <button type="button" className="dp-nav" onClick={() => setYearPage(yearPage + 12)} disabled={yearPage + 11 >= maxYear} aria-label="Later years"><Chevron dir="right" /></button>
          </div>
          <div className="dp-cells">
            {Array.from({ length: 12 }, (_, i) => yearPage + i).map(y => (
              <button
                key={y}
                type="button"
                className={`dp-cell${y === cy ? " sel" : ""}`}
                disabled={y < minYear || y > maxYear}
                onClick={() => { setCursor(clamp(addMonths(cursor, (y - cy) * 12), min, maxDate)); setView("months"); }}
              >{y}</button>
            ))}
          </div>
        </>
      )}

      <div className="dp-foot">
        {allowClear && value
          ? <button type="button" className="dp-link" onClick={() => select("")}>Clear</button>
          : <span />}
        <button type="button" className="dp-link strong" onClick={() => select(clamp(today, min, maxDate))} disabled={today > maxDate || today < min}>Today</button>
      </div>
    </div>,
    portalRoot,
  );

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`dp-trigger${invalid ? " err" : ""}${open ? " open" : ""}`}
        onClick={() => (open ? close(false) : openPicker())}
        onKeyDown={e => { if (e.key === "ArrowDown" && !open) { e.preventDefault(); openPicker(); } }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? "dp-val" : "dp-ph"}>{value ? formatDisplayDate(value) : placeholder}</span>
        <CalendarIcon />
      </button>
      {popup}
    </>
  );
}
