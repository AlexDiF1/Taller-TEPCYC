#!/usr/bin/env python3
"""Servidor estatico minimo para el sitio TODOENPCYCONSOLAS 2.

- Sirve el arbol del sitio (index.html en /), sin listado de directorios.
- Bloquea archivos ocultos (.git, .env, .token...).
- Cabeceras de cache larga para fuentes/imagenes y corta para HTML/CSS/JS.
"""
import json
import mimetypes
import os
import posixpath
import re
import sys
import time
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
# Automatizaciones (n8n): los leads del formulario entran por aquí, mismo origen,
# y se reenvían al webhook local. Si n8n está caído se guardan en cola: no se pierde ninguno.
N8N_LEADS = os.environ.get("N8N_LEADS_WEBHOOK", "http://127.0.0.1:5678/webhook/leads")
REGISTRO_LEADS = os.environ.get(
    "REGISTRO_LEADS", "/opt/data/proyectos/n8n/leads.jsonl"
)
COLA_LEADS = os.environ.get(
    "COLA_LEADS", "/opt/data/proyectos/n8n/leads-pendientes.jsonl"
)

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

    def do_POST(self):
        ruta = self.path.split("?", 1)[0]
        if ruta == "/api/leads":
            return self.recibir_lead()
        self.send_error(405, "Method Not Allowed")

    def recibir_lead(self):
        """Recibe el formulario de reparación y lo entrega a n8n (webhook local)."""
        try:
            largo = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            largo = 0
        datos = None
        if 0 < largo <= 8192:
            try:
                datos = json.loads(self.rfile.read(largo).decode("utf-8"))
            except (ValueError, UnicodeDecodeError):
                datos = None
        if not isinstance(datos, dict):
            cuerpo, estado = b'{"ok":false}', 400
        else:
            cuerpo, estado = self.reenviar_lead(datos)
        self._api = True
        self.send_response(estado)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def reenviar_lead(self, datos):
        lead = {
            "recibido": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "origen": "tepcyc.com/reparacion",
            "ip": self.headers.get("CF-Connecting-IP") or self.address_string(),
            "agente": (self.headers.get("User-Agent") or "")[:300],
            "datos": {k: (str(v)[:600] if not isinstance(v, (int, float)) else v)
                      for k, v in list(datos.items())[:20]},
        }
        linea = json.dumps(lead, ensure_ascii=False)
        # 1) Registro propio: el lead queda guardado aunque n8n esté caído.
        try:
            with open(REGISTRO_LEADS, "a", encoding="utf-8") as f:
                f.write(linea + "\n")
        except OSError as err:
            sys.stderr.write("no se pudo registrar lead: %s\n" % err)
        # 2) Aviso/automatización en n8n.
        try:
            peticion = urllib.request.Request(
                N8N_LEADS, data=linea.encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST",
            )
            with urllib.request.urlopen(peticion, timeout=6) as resp:
                resp.read()
            return b'{"ok":true,"via":"n8n"}', 202
        except (urllib.error.URLError, OSError, TimeoutError) as err:
            sys.stderr.write("lead -> n8n fallo (%s), queda en cola\n" % err)
            try:
                with open(COLA_LEADS, "a", encoding="utf-8") as f:
                    f.write(linea + "\n")
            except OSError:
                return b'{"ok":true,"via":"registro"}', 202
            return b'{"ok":true,"via":"cola"}', 202

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
