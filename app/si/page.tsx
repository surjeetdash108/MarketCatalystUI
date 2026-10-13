import { IQShell } from "../iq/shell";
import { StockIntelligenceScreen } from "../iq/si/stock-intelligence";

export default function StockIntelligencePage() {
  return (
    <IQShell>
      <StockIntelligenceScreen />
    </IQShell>
  );
}
