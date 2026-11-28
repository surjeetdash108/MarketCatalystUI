/**
 * Runs `tick` at the start of every wall-clock minute (and once when the tab comes back to the
 * foreground, since browsers slow timers in a background tab). Returns a function that stops it.
 *
 * A plain setInterval(tick, 60_000) runs on the phase of whenever the page loaded, so a clock that
 * shows minutes can be up to 59 seconds behind the real time: a header reading 12:02 while the
 * price stamp and the computer's clock already say 12:03. Aiming each tick at the next :00 keeps
 * every clock on the screen changing together with the real minute.
 */
export function everyMinute(tick: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    // +50 ms so the tick lands just after the boundary, never a hair before it.
    timer = setTimeout(() => {
      tick();
      schedule();
    }, 60_000 - (Date.now() % 60_000) + 50);
  };
  const onVisible = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") tick();
  };
  schedule();
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);
  return () => {
    if (timer !== undefined) clearTimeout(timer);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
  };
}
