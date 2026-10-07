"""Local-only preview and deterministic atlas capture endpoint."""
import argparse
import json
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import re
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        capture = re.fullmatch(r'/api/capture/(pjsk-[a-z-]+)/actions-hd/([a-z0-9-]+)\.json', parsed.path)
        if capture:
            target = ROOT/'build/renders'/capture[1]/'actions-hd'/(capture[2]+'.json')
            if not target.is_file():
                self.send_error(404); return
            body = target.read_bytes(); self.send_response(200)
            self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(body)))
            self.end_headers(); self.wfile.write(body); return
        if parsed.path == '/host/index.html':
            from urllib.parse import parse_qs
            character = parse_qs(parsed.query).get('character', ['pjsk-ichika'])[0]
            if not re.fullmatch(r'pjsk-[a-z-]+', character):
                self.send_error(400); return
            text = (ROOT/'.cache/hosts/clawd-on-desk/src/index.html').read_text(encoding='utf8')
            text = text.replace('<script src="pet-accessory-layout.js">',
                                f'<script src="/host-config/{character}.js"></script>'
                                '<script src="/app/host-shim.js"></script>'
                                '<script src="pet-accessory-layout.js">')
            body=text.encode('utf8'); self.send_response(200)
            self.send_header('Content-Type','text/html; charset=utf-8')
            self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body);return
        super().do_GET()

    def translate_path(self, path):
        path = urlparse(path).path
        if path == '/': path = '/app/index.html'
        if path.startswith('/app/'):
            base, suffix = ROOT/'web', path[5:]
        elif path.startswith('/vendor/'):
            base, suffix = ROOT/'vendor', path[8:]
        elif path.startswith('/host/'):
            base, suffix = ROOT/'.cache/hosts/clawd-on-desk/src', path[6:]
        elif path.startswith('/clawd-themes/'):
            base, suffix = ROOT/'dist/mysekai-clawd/themes', path[14:]
        else:
            base, suffix = ROOT/'build/web', path.lstrip('/')
        resolved = (base/suffix).resolve()
        return str(resolved if resolved.is_relative_to(base.resolve()) else base/'not-found')

    def do_POST(self):
        match = re.fullmatch(r'/api/capture/(pjsk-[a-z-]+)/(actions-hd/[a-z0-9-]+)\.(png|json)', self.path)
        origin = self.headers.get('Origin')
        if not match or origin not in (None, f'http://127.0.0.1:{self.server.server_port}'):
            self.send_error(403); return
        length = int(self.headers.get('Content-Length', 0))
        if not 0 < length <= 32 * 1024**2:
            self.send_error(413); return
        data = self.rfile.read(length)
        if match[3] == 'json':
            try:
                meta = json.loads(data)
                assert match[2].startswith('actions-hd/') and len(data) < 4096
                assert meta['revision'] == '0.3.0-hd1' and meta['fps'] == 60
                assert (meta['width'], meta['height']) == (384,416)
            except (ValueError, KeyError, TypeError, AssertionError):
                self.send_error(400); return
        elif not data.startswith(b'\x89PNG\r\n\x1a\n'):
            self.send_error(400); return
        target = ROOT/'build/renders'/match[1]/(match[2]+'.'+match[3])
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        self.send_response(200); self.send_header('Content-Type','application/json'); self.end_headers()
        self.wfile.write(json.dumps({'saved': str(target.relative_to(ROOT)), 'bytes':len(data)}).encode())

    def log_message(self, format, *args):
        if args and (str(args[0]).startswith('POST') or (len(args)>1 and str(args[1])!='200')):
            super().log_message(format, *args)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--port',type=int,default=8766); args=ap.parse_args()
    print(f'MySekai pet preview: http://127.0.0.1:{args.port}',flush=True)
    ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
