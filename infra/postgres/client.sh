set -euo pipefail
[[ ${U1_PROFILE:-} == synthetic ]] || exit 40
role=${1:?}
mode=${2:-valid}
case "$role" in
  line_event_app|privacy_app) ;;
  bootstrap)
    exec psql -X -qAt -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate -h /run/u1 -U u1_bootstrap -d lunch_bot ;;
  *) exit 40 ;;
esac
export PGPASSFILE="/run/u1/$role.pgpass"
export PGSSLMODE=verify-full PGSSLROOTCERT=/run/u1/ca.crt PGCONNECT_TIMEOUT=3
host=u1-pg
case "$mode" in
  valid) ;;
  wrong_ca) export PGSSLROOTCERT=/run/u1/wrong-ca.crt ;;
  wrong_name) host=localhost ;;
  plaintext) export PGSSLMODE=disable ;;
  *) exit 40 ;;
esac
exec psql -X -qAt -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate -h "$host" -U "$role" -d lunch_bot
