#!/usr/bin/env bash
# Restrict the Firebase browser API key to our websites and the 4 APIs they use.
#
#   scripts/restrict-browser-key.sh plan      show the change, touch nothing (default)
#   scripts/restrict-browser-key.sh backup    save the key's current settings (no key string)
#   scripts/restrict-browser-key.sh apply     back up, then apply the restriction
#   scripts/restrict-browser-key.sh verify    allowed origin works, others / other APIs are refused
#   scripts/restrict-browser-key.sh rollback  restore the settings from the backup
#
# The key string is public by design (it ships in every page); this script still
# never prints it. Changes take up to ~5 minutes to take effect.
#
# APIs: the only ones this key called successfully in the 30 days to 2026-11-20
# (Cloud Monitoring, serviceruntime request_count by credential):
#   securetoken (8,986)  identitytoolkit (5,348)  firebase (3,612)  firebaseinstallations (397)
# Referrers: every origin that loads the Firebase web SDK with this key.
#   app.marketcatalyst.ai         MarketCatalystUI (also its authDomain, /__/auth handler)
#   marketcatalyst.web.app        Hosting site "marketcatalyst" default domain
#   marketcatalyst.firebaseapp.com
#   market-catalyst-502415.web.app / .firebaseapp.com
#                                 default Hosting site; .firebaseapp.com is the website's authDomain
#   marketcatalyst.ai, www.marketcatalyst.ai, *.hosted.app URL
#                                 MarketCatalystWebsite (App Hosting, us-east4) — /admin/login
#   localhost / 127.0.0.1         local development (drop with NO_LOCALHOST=1)
set -euo pipefail

PROJECT="market-catalyst-502415"
KEY_ID="833362a8-6eb3-4009-baad-75eceebb3788"
BACKUP="${BACKUP:-$HOME/browser-key-backup-$(date +%Y-%m-%d).json}"

REFERRERS=(
  "https://app.marketcatalyst.ai/*"
  "https://marketcatalyst.web.app/*"
  "https://marketcatalyst.firebaseapp.com/*"
  "https://market-catalyst-502415.web.app/*"
  "https://market-catalyst-502415.firebaseapp.com/*"
  "https://marketcatalyst.ai/*"
  "https://www.marketcatalyst.ai/*"
  "https://marketcatalystwebsite--market-catalyst-502415.us-east4.hosted.app/*"
)
if [[ "${NO_LOCALHOST:-0}" != "1" ]]; then
  REFERRERS+=("http://localhost:*/*" "http://127.0.0.1:*/*")
fi

APIS=(
  identitytoolkit.googleapis.com
  securetoken.googleapis.com
  firebaseinstallations.googleapis.com
  firebase.googleapis.com
)

referrer_csv() { local IFS=,; echo "${REFERRERS[*]}"; }
api_flags() { for a in "${APIS[@]}"; do printf -- '--api-target=service=%s ' "$a"; done; }

backup() {
  if [[ -s "$BACKUP" ]]; then echo "backup exists: $BACKUP (kept)"; return; fi
  gcloud services api-keys describe "$KEY_ID" --project "$PROJECT" --format=json > "$BACKUP"
  echo "backup saved: $BACKUP"
}

plan() {
  echo "Key: $KEY_ID (project $PROJECT)"
  echo; echo "Current:"
  gcloud services api-keys describe "$KEY_ID" --project "$PROJECT" \
    --format="value(restrictions.browserKeyRestrictions.allowedReferrers.list(),restrictions.apiTargets.len())" \
    | awk -F'\t' '{print "  referrers: " ($1==""?"(none — works from anywhere)":$1); print "  API targets: " $2}'
  echo; echo "After apply:"
  printf '  referrer  %s\n' "${REFERRERS[@]}"
  printf '  API       %s\n' "${APIS[@]}"
  echo; echo "Command:"
  echo "  gcloud services api-keys update $KEY_ID --project $PROJECT \\"
  echo "    --allowed-referrers=\"$(referrer_csv)\" \\"
  echo "    $(api_flags)"
}

apply() {
  backup
  # Google refuses to drop an API the key used in the last 7 days. On
  # 2026-11-20 that was geocoding-backend: 2 calls (Nov 13, Nov 18), both 403,
  # from no code of ours — someone else using the public key, which is what
  # this restriction stops. SKIP_USAGE_CHECK=1 overrides that check.
  local usage=()
  [[ "${SKIP_USAGE_CHECK:-0}" == "1" ]] && usage=(--no-check-existing-usage)
  # shellcheck disable=SC2046
  gcloud services api-keys update "$KEY_ID" --project "$PROJECT" "${usage[@]}" \
    --allowed-referrers="$(referrer_csv)" $(api_flags)
  echo "Applied. Wait ~5 minutes, then run: $0 verify  (and the manual checklist)."
}

# HTTP status for a sign-in attempt with deliberately wrong credentials:
# 400 = the key was accepted (request reached Auth), 403 = the key was refused.
signin_status() {
  local referer="$1" key="$2"
  local args=(-s -o /tmp/rk.$$ -w "%{http_code}" -H "Content-Type: application/json"
    -d '{"email":"nobody@example.invalid","password":"wrong-password","returnSecureToken":true}')
  [[ -n "$referer" ]] && args+=(-H "Referer: $referer")
  curl "${args[@]}" "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$key"
}
reason() { python3 -I -c "import json,sys;d=json.load(open(sys.argv[1]));e=d.get('error',{});print(e.get('message') or (e.get('details') or [{}])[0].get('reason',''))" "/tmp/rk.$$" 2>/dev/null || true; }

verify() {
  local key; key="$(gcloud services api-keys get-key-string "$KEY_ID" --project "$PROJECT" --format='value(keyString)')"
  local fail=0 code
  check() { # label expected actual
    if [[ "$3" == "$2" ]]; then echo "  ok    $1 ($3 $(reason))"; else echo "  FAIL  $1: expected $2, got $3 $(reason)"; fail=1; fi
  }
  echo "Auth from allowed origins (expect 400 = key accepted, wrong password):"
  for r in "https://app.marketcatalyst.ai/" "https://marketcatalyst.ai/" "https://market-catalyst-502415.firebaseapp.com/"; do
    code=$(signin_status "$r" "$key"); check "$r" 400 "$code"
  done
  echo "Refused origins (expect 403):"
  code=$(signin_status "" "$key"); check "no Referer (scripts, curl)" 403 "$code"
  code=$(signin_status "https://evil.example/" "$key"); check "https://evil.example/" 403 "$code"
  echo "API no longer allowed (expect 403):"
  code=$(curl -s -o /tmp/rk.$$ -w "%{http_code}" -H "Referer: https://app.marketcatalyst.ai/" \
    "https://firestore.googleapis.com/v1/projects/$PROJECT/databases/mc-regional/documents/companies/AAPL?key=$key")
  check "Firestore REST with the key" 403 "$code"
  rm -f /tmp/rk.$$
  echo
  if [[ $fail == 0 ]]; then echo "Automated checks passed."; else echo "Some checks FAILED — consider: $0 rollback"; fi
  cat <<'EOF'

Manual checklist (private window, each must work):
  app.marketcatalyst.ai : email sign-in · Google sign-in · sign-up + OTP · forgot password
                          · still signed in after 1 hour (token refresh) · /auth/action link
  marketcatalyst.ai     : /admin/login
  DevTools Network      : firebase webConfig (Analytics) returns 200
EOF
  return $fail
}

rollback() {
  [[ -s "$BACKUP" ]] || { echo "no backup at $BACKUP (set BACKUP=...)"; exit 1; }
  local targets
  targets=$(python3 -I -c "import json,sys;d=json.load(open(sys.argv[1]));print(' '.join('--api-target=service='+t['service'] for t in d.get('restrictions',{}).get('apiTargets',[])))" "$BACKUP")
  local refs
  refs=$(python3 -I -c "import json,sys;d=json.load(open(sys.argv[1]));print(','.join(d.get('restrictions',{}).get('browserKeyRestrictions',{}).get('allowedReferrers',[])))" "$BACKUP")
  gcloud services api-keys update "$KEY_ID" --project "$PROJECT" --clear-restrictions
  if [[ -n "$refs" ]]; then
    # shellcheck disable=SC2086
    gcloud services api-keys update "$KEY_ID" --project "$PROJECT" --allowed-referrers="$refs" $targets
  elif [[ -n "$targets" ]]; then
    # shellcheck disable=SC2086
    gcloud services api-keys update "$KEY_ID" --project "$PROJECT" $targets
  fi
  echo "Restored from $BACKUP. Takes up to ~5 minutes."
}

case "${1:-plan}" in
  plan) plan ;;
  backup) backup ;;
  apply) apply ;;
  verify) verify ;;
  rollback) rollback ;;
  *) echo "usage: $0 plan|backup|apply|verify|rollback"; exit 2 ;;
esac
