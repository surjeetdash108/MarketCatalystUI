import { AuthLayout } from "../auth-layout";
import { ActionHandler } from "./action-handler";

export default function AuthActionPage() {
  return (
    <AuthLayout>
      <ActionHandler />
    </AuthLayout>
  );
}
