#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
start_year="${SYNC_START_YEAR:-2026}"
plan_end_year="${SYNC_END_YEAR:-2030}"
current_year="$(TZ=Asia/Shanghai date +%Y)"
end_date="${SYNC_END_DATE:-$(TZ=Asia/Shanghai date +%F)}"

if (( current_year > plan_end_year )); then
  current_year="${plan_end_year}"
fi

: "${GOOGLE_HEALTH_CLIENT_ID:?GOOGLE_HEALTH_CLIENT_ID is required}"
: "${GOOGLE_HEALTH_CLIENT_SECRET:?GOOGLE_HEALTH_CLIENT_SECRET is required}"

cd "${repo_dir}/google-health-cli"
for ((year = start_year; year <= current_year; year++)); do
  year_end_date="${year}-12-31"
  if (( year == current_year )); then
    year_end_date="${end_date}"
  fi

  go run . sleep export \
    --year "${year}" \
    --end-date "${year_end_date}" \
    --group-by month \
    --merge
done

cd "${repo_dir}/sleep-map"
node scripts/build-sleep-data.mjs \
  "${repo_dir}/data/google-health/sleep" \
  "${repo_dir}/sleep-map/app/data/sleep-data.json"

if [[ "${SKIP_SITE_BUILD:-0}" != "1" ]]; then
  npm run build:pages
fi
