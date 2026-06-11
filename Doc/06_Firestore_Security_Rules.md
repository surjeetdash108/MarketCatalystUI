# Market Intelligence Platform — Firestore Security Rules

v1.0 | June 2026

The deployable rules file is `firestore.rules` in this folder. Deploy with:

```bash
firebase deploy --only firestore:rules
```

---

## 1. Core Design Principles

**Principle 1 — Tier via custom claims, not Firestore reads.**
Subscription tier (`free` / `pro` / `premium`) is stored as a Firebase Auth custom claim on the user's ID token, not read from Firestore during rule evaluation. This means zero extra Firestore reads per request and instant evaluation.

The backend sets the claim whenever a Stripe webhook fires (subscription created, updated, or cancelled):

```js
// Node.js — called from Stripe webhook handler in Fastify
await admin.auth().setCustomUserClaims(uid, { tier: 'pro' });
```

The client must refresh its token after an upgrade for the new claim to take effect:
```js
// React — force token refresh after Stripe checkout success
await firebase.auth().currentUser.getIdToken(/* forceRefresh */ true);
```

**Principle 2 — All market data is server-write-only.**
Every market data collection (`news`, `earnings_events`, `analyst_actions`, etc.) has `allow write: if false`. ECS workers use Firebase Admin SDK, which bypasses security rules entirely — so workers write freely. Clients can never write to these collections, even if they craft a direct Firestore SDK call.

**Principle 3 — User data is uid-scoped.**
All user sub-collections (`portfolios`, `watchlists`, `alerts`, `notifications`) are readable and writable only by the owning user. No user can read another user's data.

**Principle 4 — Field-level gating stays at the API layer.**
Firestore rules are all-or-nothing per document. They cannot strip individual fields before returning a document. Tier-gated fields (e.g. `aiNote` on analyst actions for Pro+ only) are stripped by the Fastify API middleware before the response reaches the client. Direct Firestore SDK reads from the client are not supported for field-level gates.

---

## 2. Collection Access Matrix

| Collection | Free | Pro | Premium | Write |
|---|---|---|---|---|
| `companies` | ✅ Read | ✅ Read | ✅ Read | Server only |
| `earnings_events` | ✅ Read | ✅ Read | ✅ Read | Server only |
| `earnings_summaries` | ❌ | ✅ Read | ✅ Read | Server only |
| `news` | ✅ Read | ✅ Read | ✅ Read | Server only |
| `analyst_actions` | ✅ Read (no AI note) | ✅ Read (full) | ✅ Read (full) | Server only |
| `macro_events` | ✅ Read | ✅ Read | ✅ Read | Server only |
| `market_movers` | ✅ Read | ✅ Read | ✅ Read | Server only |
| `options_flow` | ❌ | ✅ Read | ✅ Read | Server only |
| `block_trades` | ❌ | ✅ Read | ✅ Read | Server only |
| `fund_holdings` | ❌ | ✅ Read | ✅ Read | Server only |
| `story_stocks` | ❌ | ❌ | ✅ Read | Server only |
| `recaps` | ❌ | ✅ Read | ✅ Read | Server only |
| `users/{uid}` | Owner only | Owner only | Owner only | Owner + server |
| `users/{uid}/portfolios` | Owner only | Owner only | Owner only | Owner |
| `users/{uid}/watchlists` | Owner only | Owner only | Owner only | Owner |
| `users/{uid}/alerts` | Owner only | Owner only | Owner only | Owner |
| `users/{uid}/notifications` | Owner (read/delete/mark-read) | Same | Same | Server only |

---

## 3. Subscription Tier Gating Details

### What's gated at the rules level (collection-level block)

These collections return a `permission-denied` error to clients without the right tier:

- `earnings_summaries` — requires Pro+
- `options_flow` — requires Pro+
- `block_trades` — requires Pro+
- `fund_holdings` (+ sub-collections) — requires Pro+
- `recaps` — requires Pro+
- `story_stocks` — requires Premium only

### What's gated at the API middleware level (field stripping)

These collections are readable by all tiers but the API strips restricted fields before returning the response:

| Collection | Restricted Field | Required Tier |
|---|---|---|
| `analyst_actions` | `aiNote` | Pro+ |
| `news` | `body` (full text) | Pro+ (basic summary free) |
| `earnings_events` | `transcriptUrl` | Pro+ |

The client always calls the REST API (`/api/v1/...`), not Firestore directly, for these endpoints. Direct Firestore SDK reads are only used for user-owned data.

### What's gated at the API middleware level (watchlist count)

- Free tier: max 5 tickers per watchlist. Firestore rules cannot count sub-collection documents, so this is enforced in the `POST /api/v1/watchlists/:id/tickers` handler.

---

## 4. Notifications: Write Rules

Notifications are created exclusively by the alert engine (server, Admin SDK). Clients can:
- **Read** their notifications
- **Mark as read** (update `read` field to `true` only — no other field changes allowed)
- **Delete** a notification (dismiss)

They cannot create notifications directly. The rule enforces this precisely:

```js
allow update: if isOwner(uid)
              && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read'])
              && request.resource.data.read == true;
```

---

## 5. User Document: Tier Protection

The `users/{uid}` document holds the `tier` field, which must only be updated by the server (Stripe webhook → Admin SDK). The `noTierOrUidChange()` helper blocks any client update that tries to modify `tier`, `uid`, `stripeCustomerId`, or `stripeSubId`:

```js
function noTierOrUidChange() {
  return !request.resource.data.diff(resource.data).affectedKeys()
           .hasAny(['uid', 'tier', 'stripeCustomerId', 'stripeSubId']);
}
```

This means a client cannot self-upgrade by writing `tier: 'premium'` directly to Firestore.

---

## 6. Deployment & Testing

**Deploy:**
```bash
firebase deploy --only firestore:rules
```

**Test rules locally with the Emulator:**
```bash
firebase emulators:start --only firestore
```

**Run the rules test suite** (add to `firestore.test.ts`):

Test cases to cover:
- Unauthenticated user cannot read any collection
- Free user cannot read `earnings_summaries`, `options_flow`, `block_trades`, `fund_holdings`, `recaps`
- Free user cannot read `story_stocks`
- Pro user can read `earnings_summaries`, `options_flow`, `block_trades`, `fund_holdings`, `recaps`
- Pro user cannot read `story_stocks`
- Premium user can read `story_stocks`
- User A cannot read `users/userB/portfolios`
- Client cannot write to `news`, `earnings_events`, or any market data collection
- Client cannot set `tier: 'premium'` on their own user document
- Client can mark notification as read but cannot change any other field
- Client cannot create a notification document

**Testing a tier upgrade flow end-to-end:**
1. Stripe webhook fires → backend calls `admin.auth().setCustomUserClaims(uid, { tier: 'pro' })`
2. Client calls `getIdToken(true)` to force-refresh
3. Subsequent Firestore reads to `earnings_summaries` now succeed

---

## 7. Firestore Indexes (firestore.indexes.json)

Define these composite indexes alongside the rules deployment:

```json
{
  "indexes": [
    { "collectionGroup": "news",             "fields": [{ "fieldPath": "tickers",    "arrayConfig": "CONTAINS" }, { "fieldPath": "publishedAt", "order": "DESCENDING" }] },
    { "collectionGroup": "news",             "fields": [{ "fieldPath": "categories", "arrayConfig": "CONTAINS" }, { "fieldPath": "publishedAt", "order": "DESCENDING" }] },
    { "collectionGroup": "analyst_actions",  "fields": [{ "fieldPath": "ticker",     "order": "ASCENDING"  }, { "fieldPath": "publishedAt",  "order": "DESCENDING" }] },
    { "collectionGroup": "analyst_actions",  "fields": [{ "fieldPath": "actionType", "order": "ASCENDING"  }, { "fieldPath": "publishedAt",  "order": "DESCENDING" }] },
    { "collectionGroup": "earnings_events",  "fields": [{ "fieldPath": "reportDate", "order": "ASCENDING"  }, { "fieldPath": "session",      "order": "ASCENDING"  }] },
    { "collectionGroup": "earnings_events",  "fields": [{ "fieldPath": "reportDate", "order": "ASCENDING"  }, { "fieldPath": "resultPosted", "order": "ASCENDING"  }] },
    { "collectionGroup": "options_flow",     "fields": [{ "fieldPath": "ticker",     "order": "ASCENDING"  }, { "fieldPath": "tradeTime",    "order": "DESCENDING" }] },
    { "collectionGroup": "options_flow",     "fields": [{ "fieldPath": "isUnusual",  "order": "ASCENDING"  }, { "fieldPath": "tradeTime",    "order": "DESCENDING" }] },
    { "collectionGroup": "block_trades",     "fields": [{ "fieldPath": "ticker",     "order": "ASCENDING"  }, { "fieldPath": "tradeTime",    "order": "DESCENDING" }] },
    { "collectionGroup": "market_movers",    "fields": [{ "fieldPath": "date",       "order": "DESCENDING" }, { "fieldPath": "session",      "order": "ASCENDING"  }, { "fieldPath": "type", "order": "ASCENDING" }] },
    { "collectionGroup": "story_stocks",     "fields": [{ "fieldPath": "isActive",   "order": "ASCENDING"  }, { "fieldPath": "publishedAt",  "order": "DESCENDING" }] },
    { "collectionGroup": "companies",        "fields": [{ "fieldPath": "sector",     "order": "ASCENDING"  }, { "fieldPath": "marketCap",    "order": "DESCENDING" }] },
    { "collectionGroup": "companies",        "fields": [{ "fieldPath": "industryGroup", "order": "ASCENDING" }, { "fieldPath": "updatedAt",  "order": "DESCENDING" }] }
  ]
}
```
