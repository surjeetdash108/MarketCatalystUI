import { IQShell } from "../../iq/shell";
import { FakePortal } from "../../iq/billing/billing-pages";

export default function BillingPortalPage() {
  return (
    <IQShell>
      <FakePortal />
    </IQShell>
  );
}
