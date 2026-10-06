set -euo pipefail
export LC_ALL=C
umask 077
phase=evidence_channel
category=runtime_check
sqlstate=none
source /opt/u1/infra/postgres/bootstrap-evidence.sh
fail() {
  trap - ERR
  if [[ ${recorded_phase:-} != "$phase" || ${recorded_status:-} != failed ]]; then
    evidence failed 2>/dev/null || true
  fi
  printf 'U1_BOOTSTRAP_FAIL=%s\n' "$phase"
  exit 41
}
checkpoint() { phase=$1; category=$2; sqlstate=none; evidence started 2>/dev/null || fail; }
trap fail ERR
phase=identity
category=identity_mismatch
[[ $(id -u) == 999 && $(id -g) == 999 && $(id -un) == postgres ]]
phase=evidence_channel
category=runtime_check
evidence started 2>/dev/null
checkpoint identity identity_mismatch
[[ ${U1_PROFILE:-} == synthetic && ${PGDATA:-} == /var/lib/postgresql/data/pgdata ]]
checkpoint tool_admission missing_tool
for tool in postgres pg_ctl initdb pg_controldata psql openssl stat realpath find sha256sum sync /usr/bin/perl; do
  command -v "$tool" >/dev/null
done
checkpoint binary_version version_mismatch
[[ $(postgres --version) == 'postgres (PostgreSQL) 17.11'* ]]
checkpoint cgroup_limits limit_mismatch
[[ $(cat /sys/fs/cgroup/memory.max) == 1073741824 ]]
[[ $(cat /sys/fs/cgroup/memory.swap.max) == 0 ]]
[[ $(cat /sys/fs/cgroup/cpu.max) == '100000 100000' ]]
[[ $(ulimit -c) == 0 ]]
checkpoint storage storage_mismatch
root=/var/lib/postgresql/data
[[ $(realpath "$root") == "$root" && ! -L "$root" ]]
read -r block_size block_count available < <(stat -f -c '%S %b %a' "$root")
[[ $((block_size * block_count)) == 2147483648 ]]
[[ $((block_size * available)) -ge 268435456 ]]
[[ $(stat -f -c '%T' /u1-temp) == tmpfs ]]
[[ $(realpath /u1-temp) == /u1-temp && $(stat -c '%u:%g:%a' /u1-temp) == 999:999:700 ]]
read -r block_size block_count available < <(stat -f -c '%S %b %a' /u1-temp)
[[ $((block_size * block_count)) == 134217728 && $((block_size * available)) -ge 117440512 ]]
[[ $(stat -f -c '%T' /run/u1) == tmpfs && $(stat -c '%u:%g:%a' /run/u1) == 999:999:700 ]]
[[ $(find /u1-temp -mindepth 1 -maxdepth 1 | wc -l) == 0 ]]
mkdir -m 700 /u1-temp/tablespace

checkpoint tls_ca tls_failed
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 2 -subj /CN=u1-synthetic-ca \
  -keyout /run/u1/ca.key -out /run/u1/ca.crt >/dev/null 2>&1
checkpoint tls_server tls_failed
openssl req -newkey rsa:2048 -nodes -sha256 -subj /CN=u1-pg \
  -keyout /run/u1/server.key -out /run/u1/server.csr >/dev/null 2>&1
printf 'subjectAltName=DNS:u1-pg\nextendedKeyUsage=serverAuth\n' > /run/u1/server.ext
openssl x509 -req -sha256 -days 2 -in /run/u1/server.csr -CA /run/u1/ca.crt \
  -CAkey /run/u1/ca.key -CAcreateserial -extfile /run/u1/server.ext \
  -out /run/u1/server.crt >/dev/null 2>&1
checkpoint tls_negative_ca tls_failed
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 2 -subj /CN=u1-wrong-ca \
  -keyout /run/u1/wrong-ca.key -out /run/u1/wrong-ca.crt >/dev/null 2>&1
rm /run/u1/ca.key /run/u1/wrong-ca.key /run/u1/server.csr /run/u1/server.ext /run/u1/ca.srl

fresh=false
checkpoint initialize initialization_failed
if [[ ! -e "$PGDATA" ]]; then
  [[ ${U1_RESUME_ONLY:-false} == false ]]
  [[ $(find "$root" -mindepth 1 -maxdepth 1 | wc -l) == 0 ]]
  read -r block_size available < <(stat -f -c '%S %a' "$root")
  [[ $((block_size * available)) -ge 1073741824 ]]
  mkdir -m 700 "$PGDATA"
  initdb -D "$PGDATA" --username=u1_bootstrap --encoding=UTF8 --locale=C \
    --data-checksums --auth-local=peer --auth-host=scram-sha-256 >/run/u1/init.log 2>&1
  fresh=true
fi
[[ ! -L "$PGDATA" && $(realpath "$PGDATA") == "$PGDATA" && $(stat -c '%u:%g:%a' "$PGDATA") == 999:999:700 ]]
[[ $(cat "$PGDATA/PG_VERSION") == 17 && ! -e "$PGDATA/postmaster.pid" ]]
[[ ! -L "$PGDATA/pg_wal" && $(realpath "$PGDATA/pg_wal") == "$PGDATA/pg_wal" ]]
[[ ! -s "$PGDATA/postgresql.auto.conf" || $(sed '/^#/d; /^[[:space:]]*$/d' "$PGDATA/postgresql.auto.conf" | wc -l) == 0 ]]
catalog=$(pg_controldata -D "$PGDATA" | sed -n 's/^Catalog version number:[[:space:]]*//p')
[[ "$catalog" =~ ^[0-9]+$ ]]
version_dir="PG_17_$catalog"
model_hash=$(sha256sum /opt/u1/db/migrations/001-model.sql | cut -d ' ' -f 1)
role_hash=$(sha256sum /opt/u1/db/roles/bootstrap.sql | cut -d ' ' -f 1)
checkpoint restart_allowlist allowlist_mismatch
if [[ "$fresh" == false ]]; then
  [[ -f "$PGDATA/u1-temp.allowlist" && ! -L "$PGDATA/u1-temp.allowlist" ]]
  [[ $(stat -c '%u:%g:%a' "$PGDATA/u1-temp.allowlist") == 999:999:600 ]]
  read -r stored_major stored_catalog stored_oid stored_path stored_model stored_roles < "$PGDATA/u1-temp.allowlist"
  [[ "$stored_major" == 17 && "$stored_catalog" == "$catalog" && "$stored_oid" =~ ^[0-9]+$ ]]
  [[ "$stored_path" == /u1-temp/tablespace && "$stored_model" == "$model_hash" && "$stored_roles" == "$role_hash" ]]
  [[ $(find "$PGDATA/pg_tblspc" -mindepth 1 -maxdepth 1 | wc -l) == 1 ]]
  [[ -L "$PGDATA/pg_tblspc/$stored_oid" && $(readlink "$PGDATA/pg_tblspc/$stored_oid") == /u1-temp/tablespace ]]
  mkdir -m 700 "/u1-temp/tablespace/$version_dir" "/u1-temp/tablespace/$version_dir/pgsql_tmp"
else
  [[ $(find "$PGDATA/pg_tblspc" -mindepth 1 -maxdepth 1 | wc -l) == 0 ]]
fi

source /opt/u1/infra/postgres/disk-temp-guard.sh
guard_checkpoint prepare

checkpoint isolated_start postgres_start_failed
config=/opt/u1/infra/postgres
pg_ctl -D "$PGDATA" -l /run/u1/postgres.log -w -t 20 \
  -o "-c config_file=$config/postgresql.conf -c hba_file=$config/pg_hba.conf -c ident_file=$config/pg_ident.conf -c listen_addresses='' -c temp_tablespaces=''" start >/dev/null 2>&1
stop_bootstrap() { pg_ctl -D "$PGDATA" -m fast -w -t 15 stop >/dev/null 2>&1 || true; }
trap stop_bootstrap EXIT
admin() {
  if psql -X -qAt -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate -h /run/u1 -U u1_bootstrap "$@" 2>/run/u1/sql-error; then
    return 0
  else
    sqlstate=$(sed -nE 's/.*ERROR:[[:space:]]+([0-9A-Z]{5})$/\1/p' /run/u1/sql-error | head -1)
    [[ "$sqlstate" =~ ^[0-9A-Z]{5}$ ]] || sqlstate=none
    category=sql_failed
    evidence failed
    return 1
  fi
}
if [[ "$fresh" == true ]]; then
  checkpoint tablespace_create sql_failed
  admin -d postgres -c "CREATE TABLESPACE u1_temp OWNER u1_bootstrap LOCATION '/u1-temp/tablespace'" >/dev/null 2>&1
  checkpoint role_migration sql_failed
  admin -d postgres -f /opt/u1/db/roles/bootstrap.sql >/run/u1/migration.log 2>&1
  checkpoint model_migration sql_failed
  admin -d lunch_bot -f /opt/u1/db/migrations/001-model.sql >>/run/u1/migration.log 2>&1
  checkpoint tablespace_grant sql_failed
  admin -d lunch_bot -c 'REVOKE ALL ON TABLESPACE u1_temp FROM PUBLIC; GRANT CREATE ON TABLESPACE u1_temp TO line_event_app, privacy_app' >/dev/null 2>&1
  stored_oid=$(admin -d lunch_bot -c "SELECT oid FROM pg_tablespace WHERE spcname='u1_temp'")
  [[ "$stored_oid" =~ ^[0-9]+$ && -d "/u1-temp/tablespace/$version_dir" ]]
  printf '17 %s %s /u1-temp/tablespace %s %s\n' "$catalog" "$stored_oid" "$model_hash" "$role_hash" > "$PGDATA/u1-temp.allowlist"
  sync -f "$PGDATA/u1-temp.allowlist"
fi
checkpoint catalog_validation catalog_mismatch
[[ $(admin -d lunch_bot -c "SELECT count(*) FROM pg_tablespace WHERE oid=$stored_oid AND spcname='u1_temp' AND pg_tablespace_location(oid)='/u1-temp/tablespace' AND pg_get_userbyid(spcowner)='u1_bootstrap'") == 1 ]]
[[ $(admin -d lunch_bot -c "SELECT count(*) FROM pg_tablespace WHERE spcname NOT IN ('pg_default','pg_global','u1_temp')") == 0 ]]
[[ $(admin -d lunch_bot -c "SELECT count(*) FROM pg_class WHERE reltablespace=$stored_oid") == 0 ]]
[[ $(admin -d lunch_bot -c "SELECT count(*) FROM pg_database WHERE dattablespace=$stored_oid") == 0 ]]
[[ $(admin -d lunch_bot -c "SELECT count(*) FROM pg_database WHERE datname='lunch_bot' AND dattablespace=(SELECT oid FROM pg_tablespace WHERE spcname='pg_default')") == 1 ]]
[[ $(admin -d lunch_bot -c "SELECT count(*) FROM pg_roles WHERE rolname IN ('line_event_app','privacy_app') AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls AND rolcanlogin AND rolconnlimit=CASE rolname WHEN 'line_event_app' THEN 4 ELSE 7 END") == 2 ]]
[[ $(admin -d lunch_bot -c "SELECT count(*) FROM pg_auth_members WHERE member IN (SELECT oid FROM pg_roles WHERE rolname IN ('line_event_app','privacy_app'))") == 0 ]]
[[ $(admin -d lunch_bot -c "SELECT count(*) FROM pg_class JOIN pg_namespace ON pg_namespace.oid=relnamespace WHERE nspname IN ('privacy','line_event') AND pg_get_userbyid(relowner)<>'u1_migration'") == 0 ]]
admin -d lunch_bot -c "UPDATE privacy.storage_safety SET state='blocked', reason='maintenance_required', checked_at=clock_timestamp()" >/dev/null 2>&1
checkpoint synthetic_credentials credential_setup_failed
for role in line_event_app privacy_app; do
  password=$(openssl rand -hex 32)
  printf "ALTER ROLE %s PASSWORD '%s';\n" "$role" "$password" | admin -d lunch_bot >/dev/null 2>&1
  printf '*:5432:lunch_bot:%s:%s\n' "$role" "$password" > "/run/u1/$role.pgpass"
  unset password
done
checkpoint isolated_stop postgres_stop_failed
pg_ctl -D "$PGDATA" -m fast -w -t 15 stop >/dev/null 2>&1
trap - EXIT
guard_checkpoint check
checkpoint tcp_start postgres_start_failed
printf 'U1_BOOTSTRAP_PASS=isolated_catalog_checked\n'
exec postgres -D "$PGDATA" -c "config_file=$config/postgresql.conf" \
  -c "hba_file=$config/pg_hba.conf" -c "ident_file=$config/pg_ident.conf" >/dev/null 2>&1
