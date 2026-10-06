set -euo pipefail
export LC_ALL=C
umask 077
[[ ${U1_PROFILE:-} == synthetic && ${PGDATA:-} == /var/lib/postgresql/data/pgdata ]]
[[ $(id -u):$(id -g) == 999:999 ]]
role=${1:?}
case "$role" in line_event_app|privacy_app) ;; *) exit 40 ;; esac
source /opt/u1/infra/postgres/disk-temp-guard.sh
guard_default_temp "$PGDATA" 999:999 check
[[ $(stat -f -c '%T' /u1-temp) == tmpfs ]]
read -r block_size block_count < <(stat -f -c '%S %b' /u1-temp)
[[ $((block_size * block_count)) == 134217728 ]]
IFS= read -r session_query
IFS= read -r files_query
IFS= read -r sort_query
[[ ${#session_query} -lt 4096 && ${#files_query} -lt 8192 && ${#sort_query} -lt 1024 ]]
work=$(mktemp -d /run/u1/ordinary-spill.XXXXXXXX)
sort_pid=
cleanup() {
  local status=$? state
  trap - EXIT
  if [[ -n "$sort_pid" ]]; then
    kill "$sort_pid" 2>/dev/null || true
    wait "$sort_pid" 2>/dev/null || true
  fi
  if [[ "$status" != 0 ]]; then
    state=$(sed -nE 's/.*(ERROR|FATAL):[[:space:]]+([0-9A-Z]{5})$/\2/p' "$work/role-error" "$work/observer-error" 2>/dev/null | head -1) || true
    if [[ "$state" =~ ^[0-9A-Z]{5}$ ]]; then printf 'ERROR: %s\n' "$state" >&2; fi
  fi
  rm -f "$work/role-error" "$work/observer-error" "$work/input" "$work/output"
  rmdir "$work"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 42' INT TERM
mkfifo "$work/input" "$work/output"
/bin/bash /opt/u1/infra/postgres/client.sh "$role" <"$work/input" >"$work/output" 2>"$work/role-error" &
sort_pid=$!
exec 3>"$work/input" 4<"$work/output"
printf '%s\n' "BEGIN; SET LOCAL work_mem='64kB'; $session_query" \
  "DECLARE u1_sort NO SCROLL CURSOR WITHOUT HOLD FOR $sort_query;" \
  '\o /dev/null' 'FETCH FORWARD 1 FROM u1_sort;' '\o' '\echo U1_SORT_READY' >&3
IFS= read -r -t 3 session <&4
printf '%s\n' "$session"
IFS= read -r -t 3 ready <&4
[[ "$ready" == U1_SORT_READY ]]
files=$(printf '%s\n' "$files_query" | /bin/bash /opt/u1/infra/postgres/client.sh bootstrap 2>"$work/observer-error")
printf '%s\n' "$files"
printf '%s\n' 'CLOSE u1_sort; COMMIT;' '\echo U1_SORT_CLOSED' >&3
exec 3>&-
IFS= read -r -t 3 closed <&4
[[ "$closed" == U1_SORT_CLOSED ]]
exec 4<&-
wait "$sort_pid"
sort_pid=
guard_default_temp "$PGDATA" 999:999 check
