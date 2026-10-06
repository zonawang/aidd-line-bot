set -euo pipefail
export LC_ALL=C
[[ $(id -u) == 999 && $(id -g) == 999 ]]
root=/var/lib/postgresql/data
data=$root/pgdata
[[ $(realpath "$data") == "$data" && $(stat -c '%u:%g:%a' "$data") == 999:999:700 ]]
[[ $(cat "$data/PG_VERSION") == 17 && ! -e "$data/postmaster.pid" ]]
[[ $(postgres --version) == 'postgres (PostgreSQL) 17.11'* ]]
[[ -f "$data/u1-temp.allowlist" && ! -L "$data/u1-temp.allowlist" ]]
[[ $(stat -c '%u:%g:%a' "$data/u1-temp.allowlist") == 999:999:600 ]]
read -r major catalog oid target model roles < "$data/u1-temp.allowlist"
[[ "$major" == 17 && "$catalog" =~ ^[0-9]+$ && "$oid" =~ ^[0-9]+$ && "$target" == /u1-temp/tablespace ]]
[[ "$model" == "$(sha256sum /opt/u1/db/migrations/001-model.sql | cut -d ' ' -f 1)" ]]
[[ "$roles" == "$(sha256sum /opt/u1/db/roles/bootstrap.sql | cut -d ' ' -f 1)" ]]
[[ $(find "$data/pg_tblspc" -mindepth 1 -maxdepth 1 | wc -l) == 1 ]]
[[ -L "$data/pg_tblspc/$oid" && $(readlink "$data/pg_tblspc/$oid") == /u1-temp/tablespace ]]
[[ ! -L "$data/pg_wal" && $(realpath "$data/pg_wal") == "$data/pg_wal" ]]
control=$(pg_controldata -D "$data")
[[ $(printf '%s\n' "$control" | sed -n 's/^Catalog version number:[[:space:]]*//p') == "$catalog" ]]
[[ $(printf '%s\n' "$control" | sed -n 's/^Database cluster state:[[:space:]]*//p') == 'shut down' ]]
system_id=$(printf '%s\n' "$control" | sed -n 's/^Database system identifier:[[:space:]]*//p')
[[ "$system_id" =~ ^[0-9]{1,20}$ ]]
printf '%s\n' "$system_id"
