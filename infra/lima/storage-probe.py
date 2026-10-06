import errno
import json
import os
import re
import signal
import stat
import subprocess
import sys

CAPACITY = 2147483648
OS_CAPACITY = 12884901888
FIRST_BYTES = 536870912
CHUNK = bytes(1048576)
RUN = "238f4c91-5090-433c-9b85-84e0484ae4c0"
DISK = "u1-238f4c91"


def require(condition):
    if not condition:
        raise ValueError("storage_rejected")


def command(arguments):
    result = subprocess.run(arguments, capture_output=True, timeout=10, check=True)
    require(len(result.stdout) <= 16384)
    return result.stdout.decode("ascii").strip()


def validate_capacity(device, partition, filesystem):
    require(device == CAPACITY and 0 < filesystem <= partition < device)


def validate_devices(rows, data_device, os_device, cidata_bytes, cidata_label):
    require(type(cidata_bytes) is int and 32768 < cidata_bytes <= 134217728)
    require(re.fullmatch(r"[A-Za-z0-9_-]{1,32}", cidata_label))
    disks = [entry for entry in rows if entry["type"] != "loop"]
    require(len(disks) == 3 and all(entry["type"] == "disk" for entry in disks))
    require(len({entry["path"] for entry in disks}) == 3 and data_device != os_device)
    require(all(re.fullmatch(r"/dev/(?:vd|sd)[a-z]+", entry["path"]) for entry in disks))
    data = [entry for entry in disks if entry["path"] == data_device]
    operating = [entry for entry in disks if entry["path"] == os_device]
    require(len(data) == 1 and len(operating) == 1)
    require(data[0]["size"] == CAPACITY and data[0]["ro"] is False)
    require(operating[0]["size"] == OS_CAPACITY and operating[0]["ro"] is False)
    media = [entry for entry in disks if entry["path"] not in (data_device, os_device)]
    require(len(media) == 1 and media[0]["size"] == cidata_bytes and media[0]["ro"] is True)
    require(media[0]["label"] == cidata_label and media[0]["fstype"] == "iso9660")


def metadata(descriptor, mode, directory=False):
    value = os.fstat(descriptor)
    require((stat.S_ISDIR(value.st_mode) if directory else stat.S_ISREG(value.st_mode)))
    require(value.st_uid == 999 and value.st_gid == 999)
    require(stat.S_IMODE(value.st_mode) == mode)
    if not directory:
        require(value.st_nlink == 1)
    return value


def same_entry(directory, name, descriptor):
    opened = metadata(descriptor, 0o600)
    current = os.stat(name, dir_fd=directory, follow_symlinks=False)
    require(stat.S_ISREG(current.st_mode))
    require((opened.st_dev, opened.st_ino) == (current.st_dev, current.st_ino))
    return opened


def fill_file(descriptor, maximum, expect_full):
    written = 0
    while written < maximum:
        try:
            count = os.write(descriptor, CHUNK[: min(len(CHUNK), maximum - written)])
            require(count > 0)
            written += count
        except OSError as error:
            if expect_full and error.errno == errno.ENOSPC:
                return written
            raise
    require(not expect_full)
    return written


def exercise_files(directory):
    metadata(directory, 0o700, True)
    require(os.listdir(directory) == [])
    files = {}
    try:
        first = os.open("first", os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_RDWR, 0o600, dir_fd=directory)
        files["first"] = first
        first_bytes = fill_file(first, FIRST_BYTES, False)
        os.fsync(first)
        same_entry(directory, "first", first)
        require("renamed" not in os.listdir(directory))
        os.rename("first", "renamed", src_dir_fd=directory, dst_dir_fd=directory)
        files["renamed"] = files.pop("first")
        same_entry(directory, "renamed", first)
        os.fsync(directory)
        second = os.open("second", os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_RDWR, 0o600, dir_fd=directory)
        files["second"] = second
        second_bytes = fill_file(second, CAPACITY, True)
        require(second_bytes > 0 and FIRST_BYTES < first_bytes + second_bytes < CAPACITY)
        os.fsync(second)
        os.fsync(first)
        require(same_entry(directory, "renamed", first).st_size == first_bytes)
        require(same_entry(directory, "second", second).st_size == second_bytes)
        return first_bytes + second_bytes
    finally:
        try:
            for name, descriptor in files.items():
                same_entry(directory, name, descriptor)
            for name in files:
                os.unlink(name, dir_fd=directory)
            os.fsync(directory)
            require(os.listdir(directory) == [])
        finally:
            for descriptor in files.values():
                os.close(descriptor)


def inspect_disk():
    require(os.geteuid() == 0 and len(sys.argv) == 5 and sys.argv[1:3] == [RUN, DISK])
    require(re.fullmatch(r"[0-9]{5,9}", sys.argv[3]))
    mount = "/mnt/lima-" + DISK
    require(os.path.realpath(mount) == mount and not os.path.islink(mount))
    label = "/dev/disk/by-label/lima-" + DISK
    partition = os.path.realpath(label)
    require(re.fullmatch(r"/dev/(?:vd|sd)[a-z]+1", partition))
    require(stat.S_ISBLK(os.stat(label).st_mode))
    mounted = json.loads(command(["findmnt", "--json", "--mountpoint", mount, "--output", "SOURCE,TARGET,FSTYPE,OPTIONS"]))["filesystems"]
    require(len(mounted) == 1)
    entry = mounted[0]
    require(entry["target"] == mount and entry["fstype"] == "ext4")
    require(os.path.realpath(entry["source"]) == partition and "rw" in entry["options"].split(","))
    require(os.stat(mount).st_dev == os.stat(partition).st_rdev)
    require(os.stat(mount).st_dev != os.stat("/").st_dev)
    mount_info = os.stat(mount)
    require(mount_info.st_uid == 0 and mount_info.st_gid == 0 and stat.S_IMODE(mount_info.st_mode) == 0o755)
    require(set(os.listdir(mount)).issubset({"lost+found"}))
    rows = json.loads(command(["lsblk", "--json", "--bytes", "--output", "PATH,TYPE,SIZE,PKNAME,LABEL,FSTYPE", partition]))["blockdevices"]
    require(len(rows) == 1)
    row = rows[0]
    require(row["type"] == "part" and row["path"] == partition and row["label"] == "lima-" + DISK and row["fstype"] == "ext4")
    require(re.fullmatch(r"(?:vd|sd)[a-z]+", row["pkname"]))
    device = "/dev/" + row["pkname"]
    size = int(command(["blockdev", "--getsize64", device]))
    root_mount = json.loads(command(["findmnt", "--json", "--mountpoint", "/", "--output", "SOURCE"]))["filesystems"]
    require(len(root_mount) == 1)
    root_partition = os.path.realpath(root_mount[0]["source"])
    require(re.fullmatch(r"/dev/(?:vd|sd)[a-z]+[0-9]+", root_partition))
    root_parent = command(["lsblk", "--noheadings", "--output", "PKNAME", root_partition])
    require(re.fullmatch(r"(?:vd|sd)[a-z]+", root_parent))
    disks = json.loads(command(["lsblk", "--json", "--bytes", "--nodeps", "--output", "PATH,TYPE,SIZE,RO,LABEL,FSTYPE"]))["blockdevices"]
    validate_devices(disks, device, "/dev/" + root_parent, int(sys.argv[3]), sys.argv[4])
    filesystem = os.statvfs(mount)
    filesystem_bytes = filesystem.f_frsize * filesystem.f_blocks
    validate_capacity(size, int(row["size"]), filesystem_bytes)
    require(filesystem.f_frsize * filesystem.f_bavail >= 1073741824)
    return mount, int(row["size"]), filesystem_bytes


def main():
    signal.alarm(120)
    os.umask(0o077)
    mount, partition_bytes, filesystem_bytes = inspect_disk()
    parent = os.open(mount, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    name = ".u1-probe-" + RUN
    os.mkdir(name, 0o700, dir_fd=parent)
    directory = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
    os.fchown(directory, 999, 999)
    owned = metadata(directory, 0o700, True)
    reader, writer = os.pipe()
    child = os.fork()
    if child == 0:
        os.close(reader)
        try:
            signal.alarm(110)
            os.setgroups([])
            os.setgid(999)
            os.setuid(999)
            require(os.getuid() == 999 and os.getgid() == 999)
            written = exercise_files(directory)
            os.write(writer, str(written).encode("ascii"))
            os._exit(0)
        except Exception:
            os._exit(1)
    os.close(writer)
    result = os.read(reader, 64)
    os.close(reader)
    _, status = os.waitpid(child, 0)
    require(os.WIFEXITED(status) and os.WEXITSTATUS(status) == 0 and result.isdigit())
    current = os.stat(name, dir_fd=parent, follow_symlinks=False)
    require((current.st_dev, current.st_ino) == (owned.st_dev, owned.st_ino))
    metadata(directory, 0o700, True)
    require(os.listdir(directory) == [])
    os.rmdir(name, dir_fd=parent)
    os.fsync(parent)
    os.close(directory)
    os.close(parent)
    print(json.dumps({"status": "passed", "deviceBytes": CAPACITY, "partitionBytes": partition_bytes,
                      "filesystemBytes": filesystem_bytes, "writtenBytes": int(result), "uid": 999, "gid": 999,
                      "files": 2, "enospc": True, "fsync": True, "rename": True, "cleanup": True}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print('{"status":"failed","category":"storage_rejected"}')
        sys.exit(1)
