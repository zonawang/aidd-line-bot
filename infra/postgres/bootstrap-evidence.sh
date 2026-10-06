evidence_directory() {
  local entries metadata
  [[ -d /u1-evidence && ! -L /u1-evidence && $(realpath /u1-evidence) == /u1-evidence ]] || return 1
  metadata=$(stat -c '%u:%g:%a' /u1-evidence) || return 1
  case "$metadata" in 0:0:700|999:999:700) ;; *) return 1 ;; esac
  entries=$(find /u1-evidence -mindepth 1 -maxdepth 1 -printf '%f\n') || return 1
  [[ "$entries" == bootstrap.status ]] || return 1
}

evidence_file() {
  local path=$1 size
  [[ -f "$path" && ! -L "$path" ]] || return 1
  [[ $(stat -c '%u:%g:%a:%h' "$path") == 999:999:600:1 ]] || return 1
  size=$(stat -c '%s' "$path") || return 1
  [[ "$size" =~ ^[0-9]+$ && "$size" -gt 0 && "$size" -le 256 ]] || return 1
}

evidence() {
  local detail=${2:-}
  evidence_directory || return 1
  evidence_file /u1-evidence/bootstrap.status || return 1
  [[ ! -e /u1-evidence/bootstrap.next && ! -L /u1-evidence/bootstrap.next ]] || return 1
  (umask 077; set -C; printf '%s %s %s %s%s\n' "$phase" "$1" "$category" "$sqlstate" "${detail:+ $detail}" > /u1-evidence/bootstrap.next) || return 1
  evidence_file /u1-evidence/bootstrap.next || return 1
  mv -T -- /u1-evidence/bootstrap.next /u1-evidence/bootstrap.status || return 1
  recorded_phase=$phase
  recorded_status=$1
}

guard_checkpoint() {
  local action=$1 result
  checkpoint disk_temp_guard disk_temp_rejected
  if guard_default_temp "$PGDATA" 999:999 "$action" 2>/dev/null; then
    result=passed
  else
    result=failed
  fi
  if ! evidence "$result" "$action $(guard_report)" 2>/dev/null; then
    phase=evidence_channel
    category=runtime_check
    fail
  fi
  [[ "$result" == passed ]] || fail
}
