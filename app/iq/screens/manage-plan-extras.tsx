"use client";

import Link from "next/link";

/** Staff full access: no plans, checkout, upgrade prompts or retention — nothing is billed. */
export function StaffPlan() {
  return (
    <>
      <div className="page-head"><div><div className="page-title">Manage Plan</div><div className="page-sub">Staff access</div></div></div>
      <div className="dash" style={{ maxWidth: 980, gridTemplateColumns: "1fr" }}>
        <div className="card col-12" data-testid="staff-plan">
          <div className="card-h"><h3>Staff access</h3></div>
          <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: "1.05rem", color: "var(--text-hi)" }}><b>Staff</b> · every feature</div>
            <div style={{ fontSize: ".84rem", color: "var(--text-dim-solid)" }}>Your account has full access to every feature and is never billed. It doesn&apos;t include the admin console.</div>
            <Link href="/dashboard" style={{ color: "var(--brand-2)", fontSize: ".84rem" }}>Back to the dashboard</Link>
          </div>
        </div>
      </div>
    </>
  );
}
