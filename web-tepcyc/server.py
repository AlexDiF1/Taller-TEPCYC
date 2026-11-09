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
        self.serve_404()
        return None

    def serve_404(self):
        """Sirve el 404.html del sitio (la ruta /no-existe la atiende este origen, no el Worker)."""
        self._es_404 = True
        ruta = os.path.join(ROOT, "404.html")
        try:
            with open(ruta, "rb") as f:
                cuerpo = f.read()
        except OSError:
            return super().send_error(404, "Not Found")
        self.send_response(404)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(cuerpo)

    def send_error(self, code, message=None, explain=None):
        if code == 404:
            return self.serve_404()
        return super().send_error(code, message, explain)

    def end_headers(self):
        ruta = self.path.split("?", 1)[0]
        es_html = ruta.endswith((".html", "/")) or ruta in ("", "/")
        if getattr(self, "_es_404", False):
            self.send_header("Cache-Control", "no-store, must-revalidate")
        elif es_html:
            # El HTML nunca se cachea: Cloudflare (Browser Cache TTL por defecto) guardaba
            # una copia 4 h en el edge y servía la version vieja tras cada cambio.
            self.send_header("Cache-Control", "no-store, must-revalidate")
        elif any(m in ruta for m in LARGA):
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
