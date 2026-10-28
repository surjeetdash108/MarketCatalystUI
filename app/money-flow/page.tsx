import { Suspense } from "react";
import { IQShell } from "../iq/shell";
import { MoneyFlowScreen } from "../iq/screens/money-flow";

export default function MoneyFlowPage() {
  return (
    <IQShell>
      <Suspense fallback={null}>
        <MoneyFlowScreen />
      </Suspense>
    </IQShell>
  );
}
