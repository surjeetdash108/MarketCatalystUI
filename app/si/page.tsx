import { Suspense } from "react";
import { IQShell } from "../iq/shell";
import { StockIntelligenceScreen } from "../iq/si/stock-intelligence";

export default function StockIntelligencePage() {
  return (
    <IQShell>
      <Suspense fallback={null}>
        <StockIntelligenceScreen />
      </Suspense>
    </IQShell>
  );
}
