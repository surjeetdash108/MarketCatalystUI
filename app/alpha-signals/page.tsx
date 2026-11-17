import { Suspense } from "react";
import { IQShell } from "../iq/shell";
import { AlphaSignalsModule } from "../iq/screens/alpha-signals-module";

export default function AlphaSignalsPage() {
  return (
    <IQShell>
      <Suspense fallback={null}>
        <AlphaSignalsModule />
      </Suspense>
    </IQShell>
  );
}
