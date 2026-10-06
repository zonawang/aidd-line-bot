set -euo pipefail
[[ ${U1_PROFILE:-} == synthetic && $(id -u) == 999 ]] || exit 40
[[ $(stat -f -c '%T' /u1-temp) == tmpfs ]] || exit 40
file=/u1-temp/.u1-exhaustion
case "${1:?}" in
  fill)
    [[ ! -e "$file" ]]
    read -r block_size blocks available < <(stat -f -c '%S %b %a' /u1-temp)
    [[ $((block_size * blocks)) == 134217728 && "$block_size" == 4096 && "$available" -gt 64 ]]
    dd if=/dev/zero of="$file" bs=4096 count="$((available - 8))" status=none 2>/dev/null
    printf 'U1_TEMP_PRESSURE=ready\n' ;;
  release)
    [[ -f "$file" && ! -L "$file" && $(stat -c '%u' "$file") == 999 ]]
    rm "$file"
    printf 'U1_TEMP_PRESSURE=released\n' ;;
  *) exit 40 ;;
esac
