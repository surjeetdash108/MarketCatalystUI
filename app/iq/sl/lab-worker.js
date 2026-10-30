// Strategy Lab Web Worker: backtests one stock per message off the main thread.
import { computeRow } from "./lab-run.js";

self.onmessage = (e) => {
  const { id, t, n, bars, spec, cfg, tf } = e.data;
  let row;
  try {
    row = computeRow(t, n, bars, spec, cfg, tf);
  } catch (err) {
    row = { t, n, status: "unavailable", err: String((err && err.message) || err) };
  }
  self.postMessage({ id, row });
};
