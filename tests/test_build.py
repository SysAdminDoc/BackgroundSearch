import importlib.util
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('builder', ROOT / 'build_extension.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class PackageTests(unittest.TestCase):
    def test_install_packages_include_license_and_setup(self):
        with tempfile.TemporaryDirectory(prefix='backgroundsearch-package-test-') as temporary:
            with patch.object(builder, 'DIST', Path(temporary) / 'dist'):
                builder.DIST.mkdir()
                for target in ('chrome', 'firefox'):
                    version = builder.read_json(ROOT / builder.TARGETS[target]['manifest'])['version']
                    stage = builder.stage_target(target, version)
                    archive = builder.zip_stage(stage, version, target)
                    with zipfile.ZipFile(archive) as package:
                        self.assertIn('LICENSE', package.namelist())
                        self.assertIn('INSTALL.html', package.namelist())
                        self.assertIsNone(package.testzip())

    def test_browser_versions_match(self):
        chrome = builder.read_json(ROOT / 'manifest.json')
        firefox = builder.read_json(ROOT / 'manifest.firefox.json')
        self.assertEqual(builder.validate_manifest('chrome', chrome),
                         builder.validate_manifest('firefox', firefox))

    def test_refuses_unexpected_clean_target(self):
        with tempfile.TemporaryDirectory(prefix='backgroundsearch-protected-test-') as temporary:
            marker = Path(temporary) / 'keep.txt'
            marker.write_text('preserve')
            with patch.object(builder, 'DIST', Path(temporary)):
                with self.assertRaisesRegex(SystemExit, 'Refusing to clean'):
                    builder.build(['chrome'], False)
            self.assertEqual(marker.read_text(), 'preserve')

    def test_zip_bytes_are_reproducible(self):
        with tempfile.TemporaryDirectory(prefix='backgroundsearch-repro-test-') as temporary:
            with patch.object(builder, 'DIST', Path(temporary)):
                version = builder.read_json(ROOT / 'manifest.json')['version']
                stage = builder.stage_target('chrome', version)
                first = builder.zip_stage(stage, version, 'chrome').read_bytes()
                self.assertEqual(first, builder.zip_stage(stage, version, 'chrome').read_bytes())


if __name__ == '__main__':
    unittest.main()
