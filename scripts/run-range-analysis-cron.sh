#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Minimal environment for cron execution.
export VOLTA_HOME="${VOLTA_HOME:-$HOME/.volta}"
export PNPM_HOME="${PNPM_HOME:-$HOME/Library/pnpm}"
export PATH="$VOLTA_HOME/bin:$PNPM_HOME:/usr/local/bin:/usr/bin:/bin"

LOG_DIR="$REPO_DIR/logs/run-range-analysis"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/$(date +%Y%m%d).log"

log() {
	local level="$1"
	shift
	printf '%s [%s] %s\n' "$(TZ=Asia/Tokyo date -Iseconds)" "$level" "$*" | tee -a "$LOG_FILE"
}

cd "$REPO_DIR"

log INFO "starting pnpm run analyze:range"
if pnpm run analyze:range; then
	log INFO "finished pnpm run analyze:range"
else
	log ERROR "pnpm run analyze:range failed"
	exit 1
fi
