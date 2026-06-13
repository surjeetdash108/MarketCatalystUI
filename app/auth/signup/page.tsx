import { AuthLayout } from "../auth-layout";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <AuthLayout wide>
      <SignupForm />
    </AuthLayout>
  );
}
