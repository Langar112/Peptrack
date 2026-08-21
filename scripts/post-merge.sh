#!/bin/bash
set -euo pipefail

install_output="$(mktemp)"
trap 'rm -f "$install_output"' EXIT

if ! pnpm install --frozen-lockfile 2>&1 | tee "$install_output"; then
  if grep -q "ERR_PNPM_OUTDATED_LOCKFILE" "$install_output"; then
    echo "Lockfile metadata is stale after the merge; refreshing it non-interactively..."
    pnpm install --lockfile-only --no-frozen-lockfile
    pnpm install --frozen-lockfile
  else
    echo "Dependency installation failed for a reason other than an outdated lockfile."
    exit 1
  fi
fi

pnpm --filter @workspace/db run push
