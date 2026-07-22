import { IQShell } from "../iq/shell";
import { DashboardScreen } from "../iq/screens/dashboard";
import { TrackFeature } from "../iq/track-feature";

export default function DashboardPage() {
  return (
    <IQShell>
      {/* Dashboard has its own route rather than /menu/[slug], so it needs its
          own tracker — otherwise the most-visited screen would be the one
          screen missing from adoption analytics. */}
      <TrackFeature feature="dashboard" />
      <DashboardScreen />
    </IQShell>
  );
}
