import { Suspense } from "react";
import { IQShell } from "../iq/shell";
import { StrategyLabScreen } from "../iq/sl/strategy-lab-screen";

export default function StrategyLabPage() {
  return (
    <IQShell>
      <Suspense fallback={null}>
        <StrategyLabScreen />
      </Suspense>
    </IQShell>
  );
}
