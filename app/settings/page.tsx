import { IQShell } from "../iq/shell";
import { SettingsScreen } from "../iq/screens/settings";

export default function SettingsPage() {
  return (
    <IQShell>
      <SettingsScreen />
    </IQShell>
  );
}
