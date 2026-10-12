"""Create a reproducible widget ZIP; no secrets, source maps or parent folders."""
from pathlib import Path
import zipfile
import json
root = Path(__file__).resolve().parents[1]
files = sorted(p for p in (root / 'widget').rglob('*') if p.is_file())
out = root / 'dist'
out.mkdir(exist_ok=True)
version=json.loads((root / 'widget/manifest.json').read_text())['widget']['version']
archive_path=out / ('result-f5-'+version+'.zip')
with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in files:
        info = zipfile.ZipInfo(path.relative_to(root / 'widget').as_posix(), (2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, path.read_bytes())
print(archive_path)
