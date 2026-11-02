/**
 * One signal that aborts when either input does: a caller's cancel signal and
 * the request's own timeout. Without a caller signal, the timeout alone.
 */
export function linkSignals(caller: AbortSignal | undefined, timeout: AbortSignal): AbortSignal {
  if (!caller) return timeout;
  const any = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any;
  if (any) return any([caller, timeout]);
  const c = new AbortController();
  const fire = () => c.abort();
  if (caller.aborted || timeout.aborted) fire();
  caller.addEventListener("abort", fire, { once: true });
  timeout.addEventListener("abort", fire, { once: true });
  return c.signal;
}
