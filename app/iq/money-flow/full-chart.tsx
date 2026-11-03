"use client";

/**
 * The pop-up's "Full Chart": the stock screen's chart (zoom, pan, full screen)
 * at the pop-up's timeframe, showing only the pop-up's six layers.
 */
import { useMemo } from "react";
import { CandleChart } from "../candle-chart";
import { useIntervalBars } from "../hooks/useBackendBars";
import { fullChartInterval, groupBars, type SmcLayers } from "./smc";
import type { PopTf } from "./engine";

export function PopFullChart({ sym, tf, layers, height }: { sym: string; tf: PopTf; layers: SmcLayers; height: number }) {
  const { interval, group } = fullChartInterval(tf);
  const { bars, loading } = useIntervalBars(sym, interval);
  const candles = useMemo(() => (bars ? groupBars(bars, group) : undefined), [bars, group]);
  const smc = useMemo(() => ({ layers, tf }), [layers, tf]);
  return <CandleChart sym={sym} tf="1D" interval={interval} realBars={candles} loading={loading} height={height} smc={smc} />;
}
