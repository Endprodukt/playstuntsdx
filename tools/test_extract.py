import tempfile
import unittest
from pathlib import Path

from extract import extract


class ExtractTests(unittest.TestCase):
    def test_uncompressed_3sh_shape_bank_is_exported(self):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            source = root / "source"
            output = root / "output"
            source.mkdir()

            shape = bytes([0, 0, 0, 0])
            size = 6 + 8 + len(shape)
            bank = (
                size.to_bytes(4, "little")
                + (1).to_bytes(2, "little")
                + b"car0"
                + (0).to_bytes(4, "little")
                + shape
            )
            (source / "STTEST.3SH").write_bytes(bank)

            data = extract(source, output)

            self.assertIn("STTEST", data["shapes"])
            self.assertIn("car0", data["shapes"]["STTEST"])
            self.assertEqual(data["shapes"]["STTEST"]["car0"]["vertices"], [])
            self.assertTrue((output / "assets.json").is_file())


if __name__ == "__main__":
    unittest.main()
