import { IQShell } from "../../iq/shell";
import { FakeCheckout } from "../../iq/billing/billing-pages";

export default function BillingCheckoutPage() {
  return (
    <IQShell>
      <FakeCheckout />
    </IQShell>
  );
}
