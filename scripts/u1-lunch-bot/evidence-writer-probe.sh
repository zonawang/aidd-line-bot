exec 2>/dev/null
set -euo pipefail
export LC_ALL=C
umask 077
exec 3>&1
write_id=first
last_step=admission
emit_step() { printf 'STEP %s %s %s\n' "$write_id" "$1" "$2" >&3; }
class_id() {
  if [[ "$1" == 0 ]]; then printf root
  elif [[ "$1" == 999 ]]; then printf pg
  elif [[ "$1" == "$2" ]]; then printf host
  else printf other; fi
}
metadata() {
  local point=$1 path=$2 info actual_owner actual_group actual_mode actual_links
  local present=no kind=missing owner=unknown group=unknown mode=unknown links=unknown
  if [[ -L "$path" ]]; then present=yes; kind=symlink
  elif [[ -e "$path" ]]; then
    present=yes; kind=other
    if [[ -f "$path" ]]; then kind=file; elif [[ -d "$path" ]]; then kind=directory; fi
    if info=$(command stat -c '%u:%g:%a:%h' -- "$path"); then
      IFS=: read -r actual_owner actual_group actual_mode actual_links <<< "$info"
      owner=$(class_id "$actual_owner" "$U1_EVIDENCE_HOST_UID")
      group=$(class_id "$actual_group" "$U1_EVIDENCE_HOST_GID")
      case "$actual_mode" in 600) mode=0600 ;; 700) mode=0700 ;; *) mode=other ;; esac
      if [[ "$actual_links" == 1 ]]; then links=one; else links=multiple; fi
    fi
  fi
  printf 'META %s %s %s %s %s %s %s %s\n' "$write_id" "$point" "$present" "$kind" "$owner" "$group" "$mode" "$links" >&3
}
trace_step() {
  local frame=$1 command_text=$2 previous=$3 step=''
  case "$frame:$command_text" in
    'evidence:evidence_directory') step=directory_check ;;
    'evidence_directory:[[ -d /u1-evidence '*) step=directory_path ;;
    'evidence_directory:metadata='*) step=directory_owner ;;
    'evidence_directory:entries='*) step=directory_list ;;
    'evidence_directory:[[ "$entries" '*) step=directory_contents ;;
    'evidence:evidence_file /u1-evidence/bootstrap.status')
      step=old_status_check; metadata old_status /u1-evidence/bootstrap.status ;;
    'evidence:[[ ! -e /u1-evidence/bootstrap.next '*) step=next_absent ;;
    'evidence:printf '*) step=next_create ;;
    'evidence:evidence_file /u1-evidence/bootstrap.next')
      step=next_check; metadata next_created /u1-evidence/bootstrap.next ;;
    'evidence_file:[[ -f "$path" '*) step=file_kind ;;
    'evidence_file:[[ $(stat '*) step=file_owner_mode_links ;;
    'evidence_file:size='*) step=file_size_read ;;
    'evidence_file:[[ "$size" '*) step=file_size_bound ;;
    'evidence:mv -T -- '*) step=rename ;;
    'evidence:recorded_phase='*) step=record_phase ;;
    'evidence:recorded_status='*) step=record_status ;;
  esac
  if [[ -n "$step" ]]; then
    last_step=$step
    emit_step "$step" "$previous"
  fi
  return 0
}
mv() {
  local command_status
  [[ $# == 4 && "$1" == -T && "$2" == -- &&
      "$3" == /u1-evidence/bootstrap.next && "$4" == /u1-evidence/bootstrap.status ]] || return 64
  metadata pre_mv_status /u1-evidence/bootstrap.status
  metadata pre_mv_next /u1-evidence/bootstrap.next
  if command mv "$@"; then command_status=0; else command_status=$?; fi
  printf 'MOVE %s %s\n' "$write_id" "$command_status" >&3
  metadata post_mv_status /u1-evidence/bootstrap.status
  metadata post_mv_next /u1-evidence/bootstrap.next
  return "$command_status"
}
finish() {
  local code=$1
  trap - DEBUG
  metadata directory /u1-evidence
  metadata final_status /u1-evidence/bootstrap.status
  metadata final_next /u1-evidence/bootstrap.next
  printf 'EXIT %s %s %s\n' "$write_id" "$last_step" "$code" >&3
}
fail() {
  local code=$?
  trap - ERR
  emit_step failure_handler "$code"
  exit 41
}
checkpoint() { phase=$1; category=$2; sqlstate=none; evidence started 2>/dev/null || fail; }
trap 'finish "$?"' EXIT
last_step=process_identity
[[ $(id -u) == 999 && $(id -g) == 999 && $(id -un) == postgres ]] || fail
emit_step process_identity_return 0
[[ "$U1_EVIDENCE_HOST_UID" =~ ^[0-9]+$ && "$U1_EVIDENCE_HOST_GID" =~ ^[0-9]+$ ]] || fail
metadata directory /u1-evidence
metadata initial_status /u1-evidence/bootstrap.status
last_step=source
source /opt/u1/infra/postgres/bootstrap-evidence.sh
phase=evidence_channel
category=runtime_check
sqlstate=none
set -T
trap 'trace_step "${FUNCNAME[0]:-main}" "$BASH_COMMAND" "$?"' DEBUG
trap fail ERR
last_step=write_call
evidence started 2>/dev/null
emit_step write_return 0
metadata directory /u1-evidence
write_id=second
last_step=checkpoint_call
checkpoint identity identity_mismatch
emit_step checkpoint_return 0
last_step=environment_identity
[[ ${U1_PROFILE:-} == synthetic && ${PGDATA:-} == /var/lib/postgresql/data/pgdata ]] || fail
emit_step environment_identity_return 0
write_id=third
last_step=checkpoint_call
checkpoint tool_admission missing_tool
emit_step checkpoint_return 0
last_step=tool_admission
for tool in postgres pg_ctl initdb pg_controldata psql openssl stat realpath find sha256sum sync /usr/bin/perl; do
  command -v "$tool" >/dev/null || fail
done
emit_step tool_admission_return 0
last_step=complete
