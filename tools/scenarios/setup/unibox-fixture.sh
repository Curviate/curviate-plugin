# unibox-fixture.sh <labelled-reply|email-thread>: one per-run Unibox fixture on Team A, written by the monorepo's seed
# script straight to the run's local clone (it refuses anything but a local env_* clone on the fake substrate).
source "$KIT_DIR/setup/lib.sh"
[ -n "$KIT_DB_URL" ] || { echo "no KIT_DB_URL" >&2; exit 1; }
R=$(cd "$KIT_DIR/../../../.." && pwd)
t="k${KIT_RUN}$(date +%s | tail -c 6)"
curviate team reply-labels --on --json > /dev/null
(
  export CURVIATE_MASTER_KEY="$("$R/scripts/envval" CURVIATE_MASTER_KEY "$R/apps/server/.env")"
  export RESEND_API_KEY="" DATABASE_URL="$KIT_DB_URL" PGBOSS_DATABASE_URL="$KIT_DB_URL" CURVIATE_SUBSTRATE_KIND=fake
  cd "$R/apps/server" && pnpm -s exec tsx scripts/seed-instance.ts --fixture "$1" --tag "$t"
) | grep -E '^[A-Z_]+='
