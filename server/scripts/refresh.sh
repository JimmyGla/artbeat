#!/usr/bin/env bash
#
# Scheduled data refresh: scrape → repair venues → audit.
#
# Designed to be run unattended (cron, launchd, GitHub Actions, a container
# entrypoint). The whole point is that a failure is LOUD: the scraper used to
# exit 0 even when it never launched a browser, so a nightly job could report
# success for weeks while the data went stale.
#
# Exit codes
#   0  refresh completed and the audit passed
#   1  a stage failed, or the audit found metrics over threshold
#   2  another refresh is already running
#
# Usage:  ./scripts/refresh.sh [--skip-scrape]

set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

LOG_DIR="${ARTBEAT_LOG_DIR:-./logs}"
mkdir -p "$LOG_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG="$LOG_DIR/refresh-$STAMP.log"

# Never let two refreshes interleave — they would fight over the same rows.
LOCK="${TMPDIR:-/tmp}/artbeat-refresh.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "A refresh is already running (lock: $LOCK). Exiting." | tee -a "$LOG"
  exit 2
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

run_stage() {
  local name="$1"; shift
  log "── $name"
  if "$@" >>"$LOG" 2>&1; then
    log "   ✓ $name"
    return 0
  else
    local code=$?
    log "   ✗ $name failed (exit $code)"
    return $code
  fi
}

log "ArtBeat refresh starting — log: $LOG"

FAILED=0

if [ "${1:-}" != "--skip-scrape" ]; then
  # A failing scrape should not stop the repair/audit stages: partial data still
  # benefits from repair, and the audit is how we learn how bad things are.
  run_stage "scrape"         npm run --silent scrape          || FAILED=1
else
  log "── scrape skipped (--skip-scrape)"
fi

run_stage "seed permanent"      npm run --silent db:seed-permanent     || FAILED=1
run_stage "reconcile"           npm run --silent db:reconcile          || FAILED=1
run_stage "repair venues"       npm run --silent db:repair-venues       || FAILED=1
run_stage "repair descriptions" npm run --silent db:repair-descriptions || FAILED=1
run_stage "tag art forms"       npm run --silent db:tag-art-forms       || FAILED=1
run_stage "audit"               npm run --silent db:audit              || FAILED=1

# Surface the audit table in the job output, not just the log file.
sed -n '/ArtBeat data audit/,$p' "$LOG" | head -40

if [ "$FAILED" -ne 0 ]; then
  log "REFRESH FAILED — see $LOG"
  exit 1
fi

log "Refresh complete."
