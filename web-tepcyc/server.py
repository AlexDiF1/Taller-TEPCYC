#!/usr/bin/env python3
"""Servidor estatico minimo para el sitio TODOENPCYCONSOLAS 2.

- Sirve el arbol del sitio (index.html en /), sin listado de directorios.
- Bloquea archivos ocultos (.git, .env, .token...).
- Cabeceras de cache larga para fuentes/imagenes y corta para HTML/CSS/JS.
"""
import mimetypes
import os
import posixpath
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "8097"))
HOST = os.environ.get("HOST", "127.0.0.1")
# App del taller (Express + SQLite) para la consulta pública de una orden.
TALLER = os.environ.get("TALLER_URL", "http://127.0.0.1:3005").rstrip("/")
PREFIJO_ORDEN = "/api/orden/"

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

    def do_GET(self):
        ruta = self.path.split("?", 1)[0]
        if ruta.startswith(PREFIJO_ORDEN):
            return self.consultar_orden(ruta)
        return super().do_GET()

    def do_HEAD(self):
        if self.path.split("?", 1)[0].startswith(PREFIJO_ORDEN):
            return self.consultar_orden(self.path.split("?", 1)[0])
        return super().do_HEAD()

    def consultar_orden(self, ruta):
        """Puente con la app del taller: consulta una orden por su número.

        Se hace aquí (mismo origen) para no exponer la app interna ni depender
        de CORS. La app responde solo con datos no sensibles.
        """
        numero = re.sub(r"[^A-Za-z0-9-]", "", ruta[len(PREFIJO_ORDEN):])[:32].upper()
        consulta = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
        sufijo = re.sub(r"[^0-9]", "", (consulta.get("t") or [""])[0])[:4]
        cuerpo, estado = b'{"encontrada":false}', 404
        if numero and len(sufijo) == 4:
            url = f"{TALLER}/api/public/orden/{urllib.parse.quote(numero)}?t={urllib.parse.quote(sufijo)}"
            try:
                with urllib.request.urlopen(url, timeout=8) as resp:
                    cuerpo, estado = resp.read(), resp.status
            except urllib.error.HTTPError as err:
                cuerpo, estado = (err.read() or b'{"encontrada":false}'), err.code
            except (urllib.error.URLError, OSError, TimeoutError):
                cuerpo, estado = b'{"error":"taller no disponible"}', 503
        self._api = True
        self.send_response(estado)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(cuerpo)

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
        if getattr(self, "_api", False) or getattr(self, "_es_404", False):
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
