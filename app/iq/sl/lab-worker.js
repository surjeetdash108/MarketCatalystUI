// Strategy Lab Web Worker: backtests one stock per message off the main thread.
// Jobs carry their scan's run id; {cancel: runId} makes queued jobs of that
// run reply {cancelled: true} without computing.
import { computeRow } from "./lab-run.js";

const cancelled = new Set();

self.onmessage = (e) => {
  if (e.data && e.data.cancel != null) { cancelled.add(e.data.cancel); return; }
  const { id, runId, t, n, bars, spec, cfg, tf } = e.data;
  if (runId != null && cancelled.has(runId)) { self.postMessage({ id, row: { t, n, cancelled: true } }); return; }
  let row;
  try {
    row = computeRow(t, n, bars, spec, cfg, tf);
  } catch (err) {
    row = { t, n, status: "unavailable", err: String((err && err.message) || err) };
  }
  self.postMessage({ id, row });
};
