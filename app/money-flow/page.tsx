import { Suspense } from "react";
import { IQShell } from "../iq/shell";
import { EntitlementGate } from "../iq/entitlement-gate";
import { MoneyFlowScreen } from "../iq/screens/money-flow";

export default function MoneyFlowPage() {
  return (
    <IQShell>
      <Suspense fallback={null}>
        <EntitlementGate slug="money-flow">
          <MoneyFlowScreen />
        </EntitlementGate>
      </Suspense>
    </IQShell>
  );
}
