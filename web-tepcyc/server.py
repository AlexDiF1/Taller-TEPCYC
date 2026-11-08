#!/usr/bin/env python3
"""Servidor estatico minimo para el sitio TODOENPCYCONSOLAS 2.

- Sirve el arbol del sitio (index.html en /), sin listado de directorios.
- Bloquea archivos ocultos (.git, .env, .token...).
- Cabeceras de cache larga para fuentes/imagenes y corta para HTML/CSS/JS.
"""
import mimetypes
import os
import posixpath
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "8097"))
HOST = os.environ.get("HOST", "127.0.0.1")

mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("application/javascript", ".js")

LARGA = ("/fonts/", "/img/", "/vendor/", ".png", ".jpg", ".jpeg", ".webp", ".woff2")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def translate_path(self, path):
        path = path.split("?", 1)[0].split("#", 1)[0]
        path = posixpath.normpath(path).lstrip("/")
        parts = [p for p in path.split("/") if p and p not in (os.curdir, os.pardir)]
        if any(p.startswith(".") for p in parts):
            return os.path.join(ROOT, "__bloqueado__")
        return os.path.join(ROOT, *parts) if parts else os.path.join(ROOT, "index.html")

    def list_directory(self, path):
        self.send_error(404, "Not Found")
        return None

    def end_headers(self):
        ruta = self.path
        if any(m in ruta for m in LARGA):
            self.send_header("Cache-Control", "public, max-age=2592000, immutable")
        elif ruta.endswith((".css", ".js")):
            self.send_header("Cache-Control", "public, max-age=3600")
        else:
            self.send_header("Cache-Control", "public, max-age=300")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        super().end_headers()

    def log_message(self, format, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))


if __name__ == "__main__":
    os.chdir(ROOT)
    srv = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"sirviendo {ROOT} en http://{HOST}:{PORT}", flush=True)
    srv.serve_forever()
