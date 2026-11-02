# Strategy Lab broker automation — what's built and what's missing

The "Automate with broker" button and modal are shown (as in the prototype).
What works today: choosing the route (TradersPost, an IBKR bridge or a custom
webhook), mode, order type, size and what to send; the exact JSON payload built
from the strategy's rules and exit plan; and **Send test signal**, a real POST
(`test: true`) from the browser to the user's https:// webhook. Alpaca, Tradier
and TradeStation sign-in say they aren't available yet, and **Connect** says
automatic signals aren't live — no strategy is run on the server, so no order,
live or paper, is ever sent.

What has to exist first:

1. **Broker OAuth on the server.** A callback endpoint that verifies `state`
   (bound to the user and the session, single use, short-lived). Client IDs and
   secrets come from env / Secret Manager, never from the browser. Tokens are
   stored encrypted per user and refreshed server-side.
2. **Signal runner.** A scheduled server job that runs after each bar closes,
   for every automated strategy and its candle. It loads the same bars, runs the
   engine's `evalLast` with the strategy's saved rules and `valCfg`, and decides
   entry or exit.
3. **Entry and exit orders.** The payload carries `action: "buy"` or
   `"sell"`. It honours the strategy's "Send" setting (entries only, exits only,
   or both) and the exit plan (stop, target, trail, max hold).
4. **Idempotency.** One key per strategy + symbol + bar timestamp + action, so a
   retried run or a duplicate tick can never send the same order twice.
5. **Order-size validation.** A positive size, within a per-user cap, and
   checked against the broker's buying power or position before sending.
6. **Paper by default.** Live trading only after an explicit re-confirmation,
   repeated whenever the strategy's rules or size change.
7. **Audit log the user can see.** Every signal, every order request and
   response, and every error, with timestamps, shown in the Lab and kept
   server-side.

Deleting a saved strategy already removes any automation config stored for it
(`delStrategy` in `lab-controller.jsx`).
