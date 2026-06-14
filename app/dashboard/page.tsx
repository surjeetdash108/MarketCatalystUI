import { IQShell } from "../iq/shell";
import { DashboardScreen } from "../iq/screens/dashboard";

export default function DashboardPage() {
  return (
    <IQShell>
      <DashboardScreen />
    </IQShell>
  );
}
