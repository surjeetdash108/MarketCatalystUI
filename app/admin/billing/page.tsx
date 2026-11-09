import { AdminBilling } from "./admin-billing";

/** Served as a real static page, so Hosting's /admin/** → console rewrite does not apply. */
export default function AdminBillingPage() {
  return <AdminBilling />;
}
