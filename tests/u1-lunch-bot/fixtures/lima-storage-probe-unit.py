import errno
import importlib.util
import os
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

specification = importlib.util.spec_from_file_location("probe", "infra/lima/storage-probe.py")
probe = importlib.util.module_from_spec(specification)
specification.loader.exec_module(probe)


class ProbeTests(unittest.TestCase):
    def test_vz_cidata(self):
        rows = [dict(path="/dev/vda", type="disk", size=probe.OS_CAPACITY, ro=False),
                dict(path="/dev/vdb", type="disk", size=probe.CAPACITY, ro=False),
                dict(path="/dev/vdc", type="disk", size=1048576, ro=True, label="synthetic-cidata", fstype="iso9660")]
        probe.validate_devices(rows, "/dev/vdb", "/dev/vda", 1048576, "synthetic-cidata")
        for changed in [dict(size=1048575), dict(ro=False), dict(label="foreign"), dict(fstype="ext4"), dict(type="rom")]:
            with self.assertRaises(ValueError):
                probe.validate_devices([*rows[:2], {**rows[2], **changed}], "/dev/vdb", "/dev/vda", 1048576, "synthetic-cidata")
        for invalid in [rows[:2], [*rows, dict(path="/dev/vdd", type="disk", size=1024, ro=True)],
                        [{**rows[0], "size": probe.OS_CAPACITY + 1}, *rows[1:]],
                        [rows[0], {**rows[1], "size": probe.CAPACITY - 1}, rows[2]],
                        [rows[0], {**rows[1], "ro": True}, rows[2]]]:
            with self.assertRaises(ValueError):
                probe.validate_devices(invalid, "/dev/vdb", "/dev/vda", 1048576, "synthetic-cidata")
        with self.assertRaises(ValueError):
            probe.validate_devices(rows, "/dev/vda", "/dev/vdb", 1048576, "synthetic-cidata")

    def test_capacity(self):
        probe.validate_capacity(2147483648, 2146000000, 2050000000)
        for values in [(2147483647, 2146000000, 2050000000), (2147483649, 2146000000, 2050000000),
                       (2147483648, 2147483648, 2050000000), (2147483648, 2146000000, 2146000001)]:
            with self.assertRaises(ValueError):
                probe.validate_capacity(*values)

    def test_metadata(self):
        valid = dict(st_mode=0o100600, st_uid=999, st_gid=999, st_nlink=1)
        with patch.object(probe.os, "fstat", return_value=SimpleNamespace(**valid)):
            probe.metadata(7, 0o600)
        for changed in [dict(st_uid=0), dict(st_gid=0), dict(st_mode=0o100666), dict(st_nlink=2), dict(st_mode=0o120600)]:
            with patch.object(probe.os, "fstat", return_value=SimpleNamespace(**{**valid, **changed})):
                with self.assertRaises(ValueError):
                    probe.metadata(7, 0o600)

    def test_fill_and_cleanup(self):
        self.exercise("enospc")

    def test_missing_enospc(self):
        self.exercise("unbounded")

    def test_io_error(self):
        self.exercise("io")

    def test_foreign_file_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            descriptor = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.symlink("/does-not-exist", directory + "/first")
                with patch.object(probe, "metadata", side_effect=lambda handle, *_: os.fstat(handle)):
                    with self.assertRaises(ValueError):
                        probe.exercise_files(descriptor)
                self.assertTrue(os.path.islink(directory + "/first"))
            finally:
                os.close(descriptor)

    def exercise(self, outcome):
        write = os.write
        def bounded_write(descriptor, content):
            if os.fstat(descriptor).st_size >= 8 and outcome != "unbounded":
                raise OSError(errno.ENOSPC if outcome == "enospc" else errno.EIO, "synthetic")
            return write(descriptor, content)
        with tempfile.TemporaryDirectory() as directory:
            descriptor = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
            try:
                with patch.object(probe, "FIRST_BYTES", 8), patch.object(probe, "CAPACITY", 24), \
                     patch.object(probe, "CHUNK", bytes(4)), \
                     patch.object(probe, "metadata", side_effect=lambda handle, *_: os.fstat(handle)), \
                     patch.object(probe.os, "write", side_effect=bounded_write):
                    if outcome == "enospc":
                        self.assertEqual(probe.exercise_files(descriptor), 16)
                    else:
                        with self.assertRaises((ValueError, OSError)):
                            probe.exercise_files(descriptor)
                self.assertEqual(os.listdir(directory), [])
            finally:
                os.close(descriptor)


if __name__ == "__main__":
    unittest.main()
