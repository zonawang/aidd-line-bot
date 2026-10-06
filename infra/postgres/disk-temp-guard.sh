guard_reset() {
  guard_reason=inspection_failed
  guard_target=context
  guard_present=unknown
  guard_owner=unknown
  guard_mode=unknown
  guard_writable=unknown
  guard_create=unknown
  guard_errno=unknown
  guard_cleanup=unknown
}

guard_create_denial() {
  local report outcome=1
  guard_reason=temp_probe
  if report=$(/usr/bin/perl "${BASH_SOURCE[0]%/*}/create-denial.pl" 2>/dev/null); then outcome=0; fi
  case "$report" in
    'U1_CREATE_DENIAL denied EACCES not_created') guard_create=denied; guard_errno=EACCES; guard_cleanup=not_created ;;
    'U1_CREATE_DENIAL denied EROFS not_created') guard_create=denied; guard_errno=EROFS; guard_cleanup=not_created ;;
    'U1_CREATE_DENIAL created none removed') guard_create=created; guard_errno=none; guard_cleanup=removed ;;
    'U1_CREATE_DENIAL created none unknown') guard_create=created; guard_errno=none ;;
    'U1_CREATE_DENIAL unknown other not_created') guard_errno=other; guard_cleanup=not_created ;;
    'U1_CREATE_DENIAL unknown other unknown') guard_errno=other ;;
    *) return 1 ;;
  esac
  if [[ "$guard_create" == created ]]; then
    guard_reason=temp_created
    [[ "$guard_cleanup" == removed ]] || guard_reason=temp_cleanup
    return 1
  fi
  [[ "$outcome" == 0 && "$guard_create" == denied && "$guard_cleanup" == not_created ]] || return 1
}

guard_metadata() {
  local path=$1 expected=$2 metadata actual_uid actual_gid actual_mode
  guard_owner=unknown
  guard_mode=unknown
  guard_writable=unknown
  if [[ -e "$path" || -L "$path" ]]; then guard_present=yes; else guard_present=no; fi
  [[ "$guard_present" == yes && ! -L "$path" ]] || return 1
  metadata=$(stat -c '%u:%g:%a' "$path") || return 1
  IFS=: read -r actual_uid actual_gid actual_mode <<< "$metadata"
  case "$actual_uid:$actual_gid" in
    "$expected") guard_owner=expected ;;
    0:0) guard_owner=root_pair ;;
    "0:${expected#*:}"|"${expected%:*}:0") guard_owner=mixed_pair ;;
    *) guard_owner=other ;;
  esac
  case "$actual_mode" in 555) guard_mode=0555 ;; 700) guard_mode=0700 ;; *) guard_mode=other ;; esac
  if [[ -w "$path" ]]; then guard_writable=yes; else guard_writable=no; fi
}

guard_default_temp() {
  local data=$1 owner=$2 action=$3 directory base mode entries
  guard_reset
  guard_reason=action
  [[ "$action" == prepare || "$action" == check ]] || return 1
  guard_target=data
  guard_reason=data_identity
  guard_metadata "$data" "$owner" || return 1
  [[ "$data" == /* && ! -L "$data" && -d "$data" && $(realpath "$data") == "$data" ]] || return 1
  [[ $(stat -c '%u:%g:%a' "$data") == "$owner:700" ]] || return 1
  base="$data/base"
  guard_target=base
  guard_reason=base_identity
  guard_metadata "$base" "$owner" || return 1
  [[ -d "$base" && ! -L "$base" && $(realpath "$base") == "$base" ]] || return 1
  [[ $(stat -c '%u:%g:%a' "$base") == "$owner:700" ]] || return 1
  directory="$base/pgsql_tmp"
  guard_target=temp
  guard_present=unknown
  guard_owner=unknown
  guard_mode=unknown
  guard_writable=unknown
  guard_reason=temp_symlink
  if [[ -e "$directory" || -L "$directory" ]]; then guard_present=yes; else guard_present=no; fi
  [[ ! -L "$directory" ]] || return 1
  if [[ ! -e "$directory" ]]; then
    guard_reason=temp_missing
    [[ "$action" == prepare ]] || return 1
    guard_reason=temp_create
    mkdir -m 555 "$directory" || return 1
  fi
  guard_reason=temp_identity
  guard_metadata "$directory" "$owner" || return 1
  [[ -d "$directory" && $(realpath "$directory") == "$directory" ]] || return 1
  mode=$(stat -c '%u:%g:%a' "$directory") || return 1
  [[ "$mode" == "$owner:700" || "$mode" == "$owner:555" ]] || return 1
  guard_reason=temp_scan
  entries=$(find "$directory" -mindepth 1 -maxdepth 1 -print -quit) || return 1
  guard_reason=temp_nonempty
  [[ -z "$entries" ]] || return 1
  if [[ "$action" == prepare && "$mode" == "$owner:700" ]]; then
    guard_reason=temp_chmod
    chmod 555 "$directory" || return 1
  fi
  guard_reason=temp_mode
  guard_metadata "$directory" "$owner" || return 1
  [[ $(stat -c '%u:%g:%a' "$directory") == "$owner:555" ]] || return 1
  guard_create_denial || return 1
  guard_reason=checked
}

guard_report() {
  printf 'U1_DISK_TEMP_GUARD %s %s %s %s %s %s %s %s %s\n' "$guard_reason" "$guard_target" "$guard_present" "$guard_owner" "$guard_mode" "$guard_writable" "$guard_create" "$guard_errno" "$guard_cleanup"
}

guard_main() {
  guard_reset
  guard_reason=profile
  [[ ${U1_PROFILE:-} == synthetic ]] || return 1
  guard_reason=data_environment
  [[ ${PGDATA:-} == /var/lib/postgresql/data/pgdata ]] || return 1
  guard_reason=process_identity
  [[ $(id -u):$(id -g) == 999:999 ]] || return 1
  guard_default_temp "$PGDATA" 999:999 check
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  set -euo pipefail
  if guard_main 2>/dev/null; then
    guard_report
  else
    guard_report
    exit 40
  fi
fi
