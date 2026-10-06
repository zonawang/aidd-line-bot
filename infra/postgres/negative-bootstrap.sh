set -euo pipefail
[[ ${U1_PROFILE:-} == synthetic && ${PGDATA:-} == /var/lib/postgresql/data/pgdata ]] || exit 40
[[ ! -e "$PGDATA/postmaster.pid" ]] || exit 40
fault=${1:?}
metadata="$PGDATA/u1-temp.allowlist"
[[ -f "$metadata" && ! -L "$metadata" ]] || exit 40
read -r major catalog oid target model roles < "$metadata"
[[ "$major" == 17 && "$catalog" =~ ^[0-9]+$ && "$oid" =~ ^[0-9]+$ && "$target" == /u1-temp/tablespace ]] || exit 40
cp "$metadata" /run/u1/original-allowlist
restore() {
  cat /run/u1/original-allowlist > "$metadata"
  if [[ "$fault" == symlink ]]; then
    [[ -L "$PGDATA/pg_tblspc/$oid" && $(readlink "$PGDATA/pg_tblspc/$oid") == /tmp ]] || return 1
    rm "$PGDATA/pg_tblspc/$oid"
    ln -s /u1-temp/tablespace "$PGDATA/pg_tblspc/$oid"
  fi
  sync -f "$metadata"
}
trap restore EXIT
case "$fault" in
  catalog) printf '17 1 %s %s %s %s\n' "$oid" "$target" "$model" "$roles" > "$metadata" ;;
  major) printf '16 %s %s %s %s %s\n' "$catalog" "$oid" "$target" "$model" "$roles" > "$metadata" ;;
  symlink)
    [[ -L "$PGDATA/pg_tblspc/$oid" && $(readlink "$PGDATA/pg_tblspc/$oid") == /u1-temp/tablespace ]]
    rm "$PGDATA/pg_tblspc/$oid"
    ln -s /tmp "$PGDATA/pg_tblspc/$oid" ;;
  *) exit 40 ;;
esac
set +e
/bin/bash /opt/u1/infra/postgres/bootstrap.sh > /run/u1/negative-result 2>/dev/null
result=$?
set -e
[[ "$result" == 41 && $(cat /run/u1/negative-result) == U1_BOOTSTRAP_FAIL=restart_allowlist ]]
[[ $(cat /u1-evidence/bootstrap.status) == 'restart_allowlist failed allowlist_mismatch none' ]]
[[ ! -e "$PGDATA/postmaster.pid" ]]
restore
trap - EXIT
printf 'U1_NEGATIVE_PASS=%s\n' "$fault"
