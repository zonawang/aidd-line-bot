set -euo pipefail
export LC_ALL=C
umask 077
root=/var/lib/postgresql/data
run_id=${1:?}
[[ "$run_id" == 961ab998-0b81-444c-ab33-578c76f008c0 ]] || exit 40
fail() { printf 'STORAGE_FAIL=%s\n' "$1"; exit 41; }
actual_uid=$(id -u)
actual_gid=$(id -g)
[[ "$actual_uid" -gt 0 && "$actual_uid" == "$(id -u postgres)" && "$actual_gid" == "$(id -g postgres)" ]] || fail nonroot_identity
printf 'STORAGE_UID=%s STORAGE_GID=%s\n' "$actual_uid" "$actual_gid"
[[ "$(cat /sys/fs/cgroup/memory.max)" == 1073741824 ]] || fail memory_limit
[[ "$(cat /sys/fs/cgroup/memory.swap.max)" == 0 ]] || fail swap_limit
[[ "$(cat /sys/fs/cgroup/cpu.max)" == '100000 100000' ]] || fail cpu_limit
[[ -d "$root" && ! -L "$root" ]] || fail mount_visibility
read -r block_size block_count < <(stat -f -c '%S %b' "$root")
[[ "$block_size" =~ ^[0-9]+$ && "$block_count" =~ ^[0-9]+$ ]] || fail capacity_metadata
[[ $((block_size * block_count)) == 2147483648 ]] || fail guest_capacity
printf 'STORAGE_CAPACITY=2147483648\n'
probe="$root/.u1-storage-probe-$run_id"
mkdir -m 700 "$probe" 2>/dev/null || fail nonroot_write
cleanup() {
  rm -f -- "$probe/first" "$probe/second" || return 1
  rmdir -- "$probe" || return 1
}
trap cleanup EXIT
[[ "$(stat -c '%u:%g:%a' "$probe")" == "$actual_uid:$actual_gid:700" ]] || fail owned_directory
dd if=/dev/zero of="$probe/first" bs=1048576 count=512 conv=fsync status=none 2>/dev/null || fail first_write_or_fsync
set +e
failure=$(dd if=/dev/zero of="$probe/second" bs=1048576 count=1536 conv=fsync status=none 2>&1)
result=$?
set -e
[[ "$result" == 1 && "$failure" == *'No space left on device'* ]] || fail enospc_not_observed
unset failure
dd if=/dev/null of="$probe/first" conv=notrunc,fsync status=none 2>/dev/null || fail fsync_after_enospc
dd if=/dev/null of="$probe/second" conv=notrunc,fsync status=none 2>/dev/null || fail fsync_after_enospc
written=$(( $(stat -c '%s' "$probe/first") + $(stat -c '%s' "$probe/second") ))
[[ "$written" -ge 536870912 && "$written" -lt 2147483648 ]] || fail written_bounds
printf 'STORAGE_ENOSPC_BYTES=%s\n' "$written"
cleanup || fail probe_cleanup
trap - EXIT
printf 'STORAGE_PASS=guest_quota_and_file_fsync_only\n'
