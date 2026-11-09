import { Suspense } from "react";
import { IQShell } from "../iq/shell";
import { EntitlementGate } from "../iq/entitlement-gate";
import { StrategyLabScreen } from "../iq/sl/strategy-lab-screen";

export default function StrategyLabPage() {
  return (
    <IQShell>
      <Suspense fallback={null}>
        <EntitlementGate slug="sl">
          <StrategyLabScreen />
        </EntitlementGate>
      </Suspense>
    </IQShell>
  );
}
