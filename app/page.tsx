import { EARLY_REDIRECT_SCRIPT } from "./auth/auth-gate";
import { LoginScreen } from "./auth/login/login-screen";

export default function Home() {
  return (
    <>
      {/* First in the page: a signed-in browser leaves for /dashboard before anything else loads (auth-gate.ts). */}
      <script dangerouslySetInnerHTML={{ __html: EARLY_REDIRECT_SCRIPT }} />
      <LoginScreen />
    </>
  );
}
