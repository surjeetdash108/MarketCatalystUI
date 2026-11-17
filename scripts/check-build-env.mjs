// Fails the production build when the Stripe publishable key is missing, so a
// build can never ship a checkout that only says "Card payments are being set up".
// The key lives in the committed .env.production (it is public: it ships to every
// browser); .env.production.local or the shell can override it.
import { existsSync, readFileSync } from "node:fs";

function fromFile(name) {
  if (!existsSync(name)) return undefined;
  const line = readFileSync(name, "utf8")
    .split("\n")
    .find((l) => l.startsWith("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="));
  return line?.split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
}

const key =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
  fromFile(".env.production.local") ??
  fromFile(".env.production") ??
  "";

if (!/^pk_(test|live)_/.test(key) || key.includes("PLACEHOLDER")) {
  console.error(
    "\nBuild stopped: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing or invalid.\n" +
      "Without it the checkout shows 'Card payments are being set up'.\n" +
      "It is set in .env.production; check that file is present.\n",
  );
  process.exit(1);
}
console.log(`Stripe publishable key OK (${key.slice(0, 8)}…)`);
