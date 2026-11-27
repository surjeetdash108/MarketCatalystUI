"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, updatePassword } from "firebase/auth";
import { firebaseAuth } from "../firebase";
import { apiGet, apiPost, apiPatch, apiDelete, apiUpload } from "../iq/backend";
import { buildAdminDataset, fetchAdminBlogs, ADMIN_DATA_KEY, ADMIN_EMAIL } from "./admin-data";
import type { ConsoleBlogRow } from "./admin-data";
import { createOpsBridge, isOpsMessage } from "./admin-ops-bridge";

/** Backend errors arrive as a JSON body string; show its `message` (e.g. "Pulse needs a header and a body."). */
function apiErrorText(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  try {
    const msg = (JSON.parse(raw) as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
    if (Array.isArray(msg) && msg.length) return msg.map(String).join(" ");
  } catch { /* not JSON */ }
  return raw || "Something went wrong.";
}

/**
 * Admin console gate. The console itself is the exact static HTML at
 * /admin/console.html (design + static data preserved verbatim), embedded in an
 * iframe. This page owns the Firebase session: it lets ONLY the admin account
 * through, feeds the admin identity into the iframe, and services the iframe's
 * logout / change-password requests (postMessage bridge).
 *
 * The admin is a single fixed account (email never changes; password can).
 * Content editors (backend ADMIN_EDITOR_EMAILS, confirmed via /api/admin/whoami)
 * get the same console with only Blogs and Content pipeline.
 */

/** True when the backend admits the signed-in account as a content editor. */
async function editorRole(): Promise<boolean> {
  try {
    const me = await apiGet<{ role?: string | null }>("/api/admin/whoami");
    return me?.role === "editor";
  } catch {
    return false;
  }
}

/**
 * The editor console's dataset: no users, plans or analytics, only the flag
 * that makes console.html show its Blogs and Content pipeline sections alone.
 */
export function editorDataset() {
  return {
    role: "editor" as const,
    users: [],
    plans: [],
    blogs: [],
    entitlementCatalog: [],
    backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? null,
    apiHealth: null,
    featureAdoption: [],
    price: {},
    generatedAt: new Date().toISOString(),
    counts: { users: 0, payments: 0, plans: 0, excludedStaff: 0 },
  };
}

export function AdminConsole() {
  const [state, setState] = useState<"checking" | "denied" | "ok">("checking");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const emailRef = useRef<string>("");
  const [dataError, setDataError] = useState<string | null>(null);

  // Gate: resolve the session, allow only the admin email.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // MUST await authStateReady(): onAuthStateChanged fires an initial `null`
      // while Firebase restores the session from IndexedDB. Judging that first
      // emission bounced the admin straight back out before the session loaded.
      await firebaseAuth.authStateReady();
      if (cancelled) return;
      const user = firebaseAuth.currentUser;
      const email = user?.email?.toLowerCase() ?? "";
      emailRef.current = email;
      if (email === ADMIN_EMAIL) {
        // Stage real Firestore data BEFORE mounting the iframe. The console
        // renders once at module scope, so anything delivered after its load
        // would be ignored — see the hand-off comment in console.html.
        //
        // Reads go through the backend's AdminGuard-protected API, not the
        // Firestore client SDK — this app bundles Firebase Auth only, so
        // Firestore rules never see these reads. The guard is the control.
        try {
          const dataset = await buildAdminDataset();
          (window as unknown as { __ADMIN_DATA__?: typeof dataset }).__ADMIN_DATA__ = dataset;
          try {
            sessionStorage.setItem(ADMIN_DATA_KEY, JSON.stringify(dataset));
          } catch (storageErr) {
            console.warn("sessionStorage quota exceeded for admin:data, relying on in-memory handoff:", storageErr);
            try {
              const lightweight = {
                ...dataset,
                blogs: dataset.blogs?.map((b: ConsoleBlogRow) => ({ ...b, html: "" })) ?? [],
              };
              sessionStorage.setItem(ADMIN_DATA_KEY, JSON.stringify(lightweight));
            } catch {
              sessionStorage.removeItem(ADMIN_DATA_KEY);
            }
          }
        } catch (err) {
          // Leave the key unset so the console falls back to its demo data and
          // shows its own "sample data" banner, rather than rendering an empty
          // console that looks like a real business with no customers.
          delete (window as unknown as { __ADMIN_DATA__?: unknown }).__ADMIN_DATA__;
          sessionStorage.removeItem(ADMIN_DATA_KEY);
          setDataError((err as Error).message);
        }
        if (cancelled) return;
        setState("ok");
      } else if (user && (await editorRole())) {
        // A content editor: Blogs and Content pipeline only. Nothing else is
        // fetched, and the backend refuses an editor on every other admin
        // route, so the trimmed console is not the only thing in the way.
        if (cancelled) return;
        const dataset = editorDataset();
        (window as unknown as { __ADMIN_DATA__?: typeof dataset }).__ADMIN_DATA__ = dataset;
        try { sessionStorage.setItem(ADMIN_DATA_KEY, JSON.stringify(dataset)); } catch { /* in-memory hand-off is enough */ }
        setState("ok");
      } else {
        setState("denied");
        // Non-admins (or signed-out) never see the console.
        window.location.replace(user ? "/dashboard" : "/auth/login");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Bridge: handle logout / password-change coming from the iframe.
  useEffect(() => {
    // Jobs and API Docs tabs. Replies go to our own origin only, not "*".
    const ops = createOpsBridge({
      get: apiGet,
      post: apiPost,
      reply: (m) => iframeRef.current?.contentWindow?.postMessage(m, window.location.origin),
    });
    const onMsg = async (e: MessageEvent) => {
      const d = e.data || {};
      if (isOpsMessage(d.type)) {
        // These can start a production job or fire a burst of authenticated
        // reads, so unlike the handlers below they act only for the console
        // iframe itself. Any other window holding a reference to this one (an
        // opener, say) can post a message but is not allowed to cause these.
        if (e.source !== iframeRef.current?.contentWindow || e.origin !== window.location.origin) return;
        await ops(d);
        return;
      }
      if (d.type === "admin:userDelete") {
        // Destructive: only from the console iframe itself.
        if (e.source !== iframeRef.current?.contentWindow || e.origin !== window.location.origin) return;
        const uid = String(d.uid ?? "");
        const reply = (m: Record<string, unknown>) =>
          iframeRef.current?.contentWindow?.postMessage({ type: "admin:userDeleteResult", uid, ...m }, window.location.origin);
        if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
          reply({ ok: false, error: "Invalid user id." });
          return;
        }
        try {
          const r = await apiDelete<{ subscriptionsCancelled: number }>(`/api/admin/users/${encodeURIComponent(uid)}`);
          reply({ ok: true, subscriptionsCancelled: r?.subscriptionsCancelled ?? 0 });
        } catch (err) {
          reply({ ok: false, error: (err as Error).message });
        }
        return;
      }
      if (d.type === "admin:logout") {
        delete (window as unknown as { __ADMIN_DATA__?: unknown }).__ADMIN_DATA__;
        sessionStorage.removeItem(ADMIN_DATA_KEY);
        await signOut(firebaseAuth);
        window.location.replace("/auth/login");
      }
      if (d.type === "admin:setPlanFlag") {
        // The console iframe holds no backend token, so it delegates the write
        // here, where the admin session lives; the backend's AdminGuard
        // authorises it.
        const reply = (m: Record<string, unknown>) =>
          iframeRef.current?.contentWindow?.postMessage(
            { type: "admin:setPlanFlagResult", planId: d.planId, key: d.key, value: d.value, ...m },
            "*",
          );
        try {
          const planId = String(d.planId);
          const key = String(d.key);
          const value = d.value === true;
          if (!planId || !key) throw new Error("missing planId or key");
          // New architecture: the browser does not write Firestore. The backend
          // owns the write — PATCH /admin/plans/:id (AdminGuard) sets only this
          // one entitlement (dotted path server-side), so a whole-map set can't
          // clobber a concurrent edit to a different flag.
          await apiPatch(`/api/admin/plans/${encodeURIComponent(planId)}`, {
            featureFlags: { [key]: value },
          });
          reply({ ok: true });
        } catch (err) {
          reply({ ok: false, error: (err as Error).message });
        }
      }
      // ── Blog board writes ──────────────────────────────────────────────
      // The console iframe has no backend token, so every blog mutation is
      // delegated here (same bridge as admin:setPlanFlag). We hit the
      // AdminGuard-protected /admin/posts REST surface, then ALWAYS re-fetch
      // the full list and post it back — even on failure — so the board
      // reconciles to the true backend state and any optimistic edit that
      // didn't persist is reverted.
      const blogWrite = async (
        resultType: string,
        write: () => Promise<void>,
      ) => {
        const post = (m: Record<string, unknown>) =>
          iframeRef.current?.contentWindow?.postMessage({ type: resultType, ...m }, "*");
        let ok = true;
        let error: string | undefined;
        try {
          await write();
        } catch (err) {
          ok = false;
          error = (err as Error).message;
        }
        post({ ok, ...(error ? { error } : {}), blogs: [] });
      };

      if (d.type === "admin:blogSave") {
        const body = {
          zone: d.zone,
          rank: d.rank,
          kick: d.kick,
          title: d.title,
          dek: d.dek,
          author: d.author,
          read: d.read,
          html: d.html,
          status: d.status,
          // `format` decides how the site renders the post. The design that used
          // to ride along as `css` is now lifted server-side into one shared
          // theme, so nothing per-post is sent for it.
          ...(d.format ? { format: d.format } : {}),
          ...(d.heroImageUrl !== undefined ? { heroImageUrl: d.heroImageUrl } : {}),
          // Sent only when the admin changed it, so a save never re-asserts a
          // stale value over a choice made since this console loaded.
          ...(typeof d.editorsChoice === "boolean" ? { editorsChoice: d.editorsChoice } : {}),
          // Source PDF, present only when the article was imported from one.
          // The backend hoists it to Storage and keeps the URL on the doc; it is
          // never written into Firestore (well past the 1 MB document cap).
          ...(d.pdfDataUri
            ? { pdfDataUri: d.pdfDataUri, pdfName: d.pdfName, pdfPages: d.pdfPages, pdfAspect: d.pdfAspect }
            : {}),
        };
        // Saves go over XHR rather than fetch so the console can show real
        // progress: an imported PDF is carried inline as a data URI and a Word
        // import can drag in externalised images, so this body is the one place
        // in the admin that is routinely megabytes.
        const onProgress = (progress: { loaded: number; total: number }) =>
          iframeRef.current?.contentWindow?.postMessage(
            {
              type: "admin:blogSaveProgress",
              loaded: progress.loaded,
              total: progress.total,
              pdf: Boolean(d.pdfDataUri),
              name: d.pdfName ?? null,
            },
            "*",
          );
        await blogWrite("admin:blogSaveResult", async () => {
          if (d.id) {
            await apiUpload(`/api/admin/posts/${encodeURIComponent(String(d.id))}`, body, {
              method: "PATCH",
              onProgress,
            });
          } else {
            await apiUpload("/api/admin/posts", body, { onProgress });
          }
        });
      }
      /* ── image library ─────────────────────────────────────────────────
         Same delegation as the blog writes: the console iframe holds no
         backend token, so it asks the parent, which has the admin session. */
      if (d.type === "admin:mediaList" || d.type === "admin:mediaUpload" || d.type === "admin:mediaDelete") {
        const reply = (m: Record<string, unknown>) =>
          iframeRef.current?.contentWindow?.postMessage({ type: "admin:mediaResult", ...m }, "*");
        try {
          if (d.type === "admin:mediaUpload") {
            // Over XHR, not fetch: an image is the one admin payload that is
            // routinely megabytes, and the console shows real upload progress.
            await apiUpload("/api/admin/media", { dataUri: d.dataUri, filename: d.filename }, {
              onProgress: (p: { loaded: number; total: number }) =>
                iframeRef.current?.contentWindow?.postMessage(
                  { type: "admin:mediaProgress", loaded: p.loaded, total: p.total, name: d.filename ?? null },
                  "*",
                ),
            });
          } else if (d.type === "admin:mediaDelete") {
            await apiDelete(`/api/admin/media/${encodeURIComponent(String(d.id))}`);
          }
          const list = await apiGet<{ media: unknown[] }>("/api/admin/media");
          reply({ ok: true, media: list.media ?? [] });
        } catch (err) {
          reply({ ok: false, error: (err as Error).message });
        }
      }
      /* ── MCP server keys ────────────────────────────────────────────────
         Same delegation as blogs/media: the console iframe holds no backend
         token, so it asks here. Every write re-fetches the list afterward
         (mirroring blogWrite above) so the table reconciles to the true
         backend state rather than trusting an optimistic local edit. */
      if (d.type === "admin:mcpKeyList" || d.type === "admin:mcpKeyCreate" || d.type === "admin:mcpKeyRevoke") {
        const reply = (m: Record<string, unknown>) =>
          iframeRef.current?.contentWindow?.postMessage({ type: `${d.type}Result`, ...m }, "*");
        let ok = true;
        let error: string | undefined;
        let rawKey: string | undefined;
        try {
          if (d.type === "admin:mcpKeyCreate") {
            const created = await apiPost<{ rawKey: string }>("/api/admin/mcp-keys", { label: d.label });
            rawKey = created.rawKey;
          } else if (d.type === "admin:mcpKeyRevoke") {
            await apiPost(`/api/admin/mcp-keys/${encodeURIComponent(String(d.id))}/revoke`);
          }
        } catch (err) {
          ok = false;
          error = (err as Error).message;
        }
        let keys: unknown[] | null = null;
        try {
          const list = await apiGet<{ keys: unknown[] }>("/api/admin/mcp-keys");
          keys = list.keys ?? [];
        } catch {
          keys = null;
        }
        reply({ ok, ...(error ? { error } : {}), ...(rawKey ? { rawKey } : {}), ...(keys ? { keys } : {}) });
      }
      /* ── User feedback (read-only list) ───────────────────────────────── */
      if (d.type === "admin:feedbackList") {
        const reply = (m: Record<string, unknown>) =>
          iframeRef.current?.contentWindow?.postMessage({ type: "admin:feedbackListResult", ...m }, "*");
        try {
          const list = await apiGet<{ feedback: unknown[] }>("/api/admin/feedback");
          reply({ ok: true, feedback: list.feedback ?? [] });
        } catch (err) {
          reply({ ok: false, error: (err as Error).message });
        }
      }
      /* ── Market Catalyst Pulse ──────────────────────────────────────────
         Posts shown on every dashboard. Same delegation as the blog board;
         every write re-fetches the list so the console shows the true state. */
      if (
        d.type === "admin:pulseList" || d.type === "admin:pulseSave" ||
        d.type === "admin:pulseDelete" || d.type === "admin:pulseSearch"
      ) {
        if (e.source !== iframeRef.current?.contentWindow || e.origin !== window.location.origin) return;
        const reply = (m: Record<string, unknown>) =>
          iframeRef.current?.contentWindow?.postMessage(m, window.location.origin);
        if (d.type === "admin:pulseSearch") {
          // Same search as Market Catalyst's box, served for the admin account
          // (which has no plan, so the user search routes refuse it): quick
          // list when empty, MC's ranking, live quotes for the visible rows.
          const q = String(d.q ?? "").slice(0, 40);
          try {
            const r = await apiGet<{ results?: unknown[] }>(`/api/admin/ticker-search?q=${encodeURIComponent(q.trim())}`);
            reply({ type: "admin:pulseSearchResult", seq: d.seq, q, results: r.results ?? [] });
          } catch (err) {
            reply({ type: "admin:pulseSearchResult", seq: d.seq, q, results: [], error: (err as Error).message });
          }
          return;
        }
        let ok = true;
        let error: string | undefined;
        try {
          if (d.type === "admin:pulseSave") {
            const body = { text: d.text, ticker: d.ticker, name: d.name, handle: d.handle };
            if (d.id) await apiPatch(`/api/admin/pulse/${encodeURIComponent(String(d.id))}`, body);
            else await apiPost("/api/admin/pulse", body);
          } else if (d.type === "admin:pulseDelete") {
            await apiDelete(`/api/admin/pulse/${encodeURIComponent(String(d.id))}`);
          }
        } catch (err) {
          ok = false;
          error = (err as Error).message;
        }
        let posts: unknown[] | undefined;
        try {
          posts = (await apiGet<{ posts: unknown[] }>("/api/admin/pulse")).posts ?? [];
        } catch (err) {
          if (ok && d.type === "admin:pulseList") { ok = false; error = (err as Error).message; }
        }
        const action = d.type === "admin:pulseSave" ? "save" : d.type === "admin:pulseDelete" ? "delete" : "list";
        reply({ type: "admin:pulseResult", action, ok, ...(error ? { error } : {}), ...(posts ? { posts } : {}) });
        return;
      }
      /* ── Stock in Focus ─────────────────────────────────────────────────
         The desk's one editorial note a day (last What Matters Now slide + the
         user archive). Same delegation as Pulse: only the console iframe may
         ask, every write re-fetches the list so the console shows the true
         state, and a failure carries the backend's own sentence (for example
         the one-per-day conflict) rather than a raw JSON body. */
      if (d.type === "admin:sifList" || d.type === "admin:sifSave" || d.type === "admin:sifDelete") {
        if (e.source !== iframeRef.current?.contentWindow || e.origin !== window.location.origin) return;
        const reply = (m: Record<string, unknown>) =>
          iframeRef.current?.contentWindow?.postMessage(m, window.location.origin);
        let ok = true;
        let error: string | undefined;
        try {
          if (d.type === "admin:sifSave") {
            const fields = { ticker: d.ticker, headline: d.headline, note: d.note };
            if (d.editing) {
              await apiPatch(`/api/admin/stock-in-focus/${encodeURIComponent(String(d.day))}`, fields);
            } else {
              await apiPost("/api/admin/stock-in-focus", { ...fields, ...(d.day ? { day: d.day } : {}) });
            }
          } else if (d.type === "admin:sifDelete") {
            await apiDelete(`/api/admin/stock-in-focus/${encodeURIComponent(String(d.day))}`);
          }
        } catch (err) {
          ok = false;
          error = apiErrorText(err);
        }
        let entries: unknown[] | undefined;
        try {
          entries = (await apiGet<{ entries: unknown[] }>("/api/admin/stock-in-focus")).entries ?? [];
        } catch (err) {
          if (ok && d.type === "admin:sifList") { ok = false; error = apiErrorText(err); }
        }
        const action = d.type === "admin:sifSave" ? "save" : d.type === "admin:sifDelete" ? "delete" : "list";
        reply({ type: "admin:sifResult", action, ok, ...(error ? { error } : {}), ...(entries ? { entries } : {}) });
        return;
      }
      /* ── Content pipeline (Blog / Pulse / Live Feed) ───────────────────────
         Submit, list, preview, approve, send back, retry — all through the
         AdminGuard'd /api/admin/content API. Only the console iframe may ask. */
      if (typeof d.type === "string" && d.type.startsWith("admin:content")) {
        if (e.source !== iframeRef.current?.contentWindow || e.origin !== window.location.origin) return;
        const action =
          d.type === "admin:contentList" ? "list" :
          d.type === "admin:contentGet" ? "get" :
          d.type === "admin:contentSubmit" ? "submit" :
          d.type === "admin:contentApprove" ? "approve" :
          d.type === "admin:contentSendBack" ? "sendBack" :
          d.type === "admin:contentRetry" ? "retry" :
          d.type === "admin:contentEdit" ? "edit" :
          d.type === "admin:contentDelete" ? "delete" : null;
        if (!action) return;
        const reply = (m: Record<string, unknown>) =>
          iframeRef.current?.contentWindow?.postMessage({ type: "admin:contentResult", action, ...m }, window.location.origin);
        const id = encodeURIComponent(String(d.id ?? "").replace(/[^A-Za-z0-9_-]/g, ""));
        try {
          let data: unknown;
          if (action === "list") data = await apiGet("/api/admin/content");
          else if (action === "get") data = await apiGet(`/api/admin/content/${id}`);
          else if (action === "submit") data = await apiPost("/api/admin/content", d.body ?? {});
          else if (action === "approve") data = await apiPost(`/api/admin/content/${id}/approve`, {});
          else if (action === "sendBack") data = await apiPost(`/api/admin/content/${id}/send-back`, { note: String(d.note ?? "") });
          else if (action === "edit") data = await apiPatch(`/api/admin/content/${id}`, d.body ?? {});
          else if (action === "delete") data = await apiDelete(`/api/admin/content/${id}`);
          else data = await apiPost(`/api/admin/content/${id}/retry`, {});
          reply({ ok: true, data });
        } catch (err) {
          reply({ ok: false, error: apiErrorText(err) });
        }
        return;
      }
      if (d.type === "admin:blogDelete") {
        await blogWrite("admin:blogDeleteResult", async () => {
          await apiDelete(`/api/admin/posts/${encodeURIComponent(String(d.id))}`);
        });
      }
      if (d.type === "admin:blogPublish") {
        await blogWrite("admin:blogPublishResult", async () => {
          await apiPatch(`/api/admin/posts/${encodeURIComponent(String(d.id))}`, {
            status: d.status,
          });
        });
      }
      if (d.type === "admin:blogReorder") {
        // Accept either a single {id, rank[, zone]} or a batch {orders:[…]}.
        const orders: Array<{ id: unknown; rank: unknown; zone?: unknown }> =
          Array.isArray(d.orders)
            ? d.orders
            : d.id != null
              ? [{ id: d.id, rank: d.rank, zone: d.zone }]
              : [];
        await blogWrite("admin:blogReorderResult", async () => {
          await Promise.all(
            orders.map((o) => {
              const patch: Record<string, unknown> = { rank: Number(o.rank) };
              // A cross-zone move carries the new zone; a plain reorder omits it.
              if (typeof o.zone === "string") patch.zone = o.zone;
              return apiPatch(`/api/admin/posts/${encodeURIComponent(String(o.id))}`, patch);
            }),
          );
        });
      }
      if (d.type === "admin:apiHealth") {
        // Live re-check for the Monitor tab. The iframe has no token, so it asks
        // here; we hit GET /admin/apihealth (AdminGuard) and post the fresh
        // report back for the console to re-render.
        const post = (m: Record<string, unknown>) =>
          iframeRef.current?.contentWindow?.postMessage({ type: "admin:apiHealthResult", ...m }, "*");
        try {
          const data = await apiGet("/api/admin/apihealth");
          post({ ok: true, data });
        } catch (err) {
          post({ ok: false, error: (err as Error).message });
        }
      }
      if (d.type === "admin:jobs") {
        // Job + scheduler inventory for the Monitor tab. Same bridge shape as
        // admin:apiHealth — the iframe holds no backend token, so it asks here.
        const post = (m: Record<string, unknown>) =>
          iframeRef.current?.contentWindow?.postMessage({ type: "admin:jobsResult", ...m }, "*");
        try {
          const data = await apiGet("/api/admin/jobs");
          post({ ok: true, data });
        } catch (err) {
          post({ ok: false, error: (err as Error).message });
        }
      }
      if (d.type === "admin:changePassword") {
        const post = (m: Record<string, unknown>) =>
          iframeRef.current?.contentWindow?.postMessage({ type: "admin:passwordResult", ...m }, "*");
        try {
          if (!firebaseAuth.currentUser) throw new Error("Session expired — sign in again.");
          await updatePassword(firebaseAuth.currentUser, String(d.password));
          post({ ok: true });
        } catch (err) {
          // Firebase requires a RECENT login for password changes.
          const msg = (err as { code?: string; message?: string }).code === "auth/requires-recent-login"
            ? "Please log out and back in, then change the password."
            : (err as Error).message || "Update failed.";
          post({ ok: false, error: msg });
        }
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  if (state !== "ok") {
    return (
      <div style={{ height: "100vh", display: "grid", placeItems: "center", background: "#090A0C", color: "#8B939C", fontFamily: "system-ui" }}>
        {state === "checking" ? "Checking admin access…" : "Redirecting…"}
      </div>
    );
  }

  return (
    <>
    {dataError && (
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 10000,
        padding: "7px 14px", background: "rgba(248,113,113,.16)", color: "#F87171",
        borderBottom: "1px solid rgba(248,113,113,.4)",
        font: "600 12px/1.4 system-ui, sans-serif", textAlign: "center",
      }}>
        ⚠ Could not load live admin data — showing sample data. {dataError}
      </div>
    )}
    <iframe
      ref={iframeRef}
      src="/admin/console.html"
      title="MarketCatalyst Admin"
      onLoad={() =>
        iframeRef.current?.contentWindow?.postMessage(
          { type: "admin:identity", email: emailRef.current },
          "*",
        )
      }
      style={{ border: "none", width: "100vw", height: "100vh", display: "block" }}
    />
    </>
  );
}
