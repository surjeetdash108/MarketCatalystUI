# Strategy Lab broker automation — before `STRATEGY_LAB_AUTOMATION` can be turned on

The "Automate with broker" button, its badges and its modal are behind the
build-time flag `NEXT_PUBLIC_STRATEGY_LAB_AUTOMATION` (`app/iq/sl/flags.js`,
default **off**). With the flag off, nothing is shown and nothing is sent. With
it on today, the modal only says the feature isn't available. No order, test
order or webhook call exists anywhere in the code.

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
