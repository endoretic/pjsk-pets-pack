"""Build reviewable local archives; credentials and cached upstream checkouts are excluded."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'dist/releases'

def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream,'sha256').hexdigest()


def archive(name, files):
    OUT.mkdir(parents=True, exist_ok=True)
    target=OUT/name
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=5) as z:
        for source, relative in sorted(files,key=lambda v:v[1]):
            assert source.is_relative_to(ROOT)
            assert not source.is_symlink()
            # Images are already compressed. Storing their bytes avoids a long,
            # ineffective second compression pass for the HD animation pack.
            z.write(source,relative,compress_type=zipfile.ZIP_STORED if source.suffix.lower() in ['.webp','.png'] else zipfile.ZIP_DEFLATED)
    with zipfile.ZipFile(target) as z:
        assert z.testzip() is None
    return {'file':name,'bytes':target.stat().st_size,'sha256':digest(target)}


def tree(folder, prefix):
    return [(f,(Path(prefix)/f.relative_to(folder)).as_posix()) for f in folder.rglob('*')
            if f.is_file() and '__pycache__' not in f.parts]


def main():
    version=json.loads((ROOT/'package.json').read_text(encoding='utf8'))['version']
    files=tree(ROOT/'dist/mysekai-clawd','')
    files += [(ROOT/'docs/INSTALL.md','README.md'),(ROOT/'docs/SOURCES.md','docs/SOURCES.md')]
    results=[archive(f'mysekai-clawd-{version}.zip',files)]
    (OUT/'SHA256.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf8')
    print(json.dumps(results,indent=2),flush=True)


if __name__=='__main__': main()
