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
import threading
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
# Tienda: catálogo público del taller (solo lectura) y la foto de cada producto.
RUTA_PRODUCTOS = "/api/productos"
FOTO_PRODUCTO = re.compile(r"/api/productos/([1-9][0-9]{0,8})/foto")
# Automatizaciones (n8n): los leads del formulario entran por aquí, mismo origen,
# y se reenvían al webhook local. Si n8n está caído se guardan en cola: no se pierde ninguno.
N8N_LEADS = os.environ.get("N8N_LEADS_WEBHOOK", "http://127.0.0.1:5678/webhook/leads")
REGISTRO_LEADS = os.environ.get(
    "REGISTRO_LEADS", "/opt/data/proyectos/n8n/leads.jsonl"
)
COLA_LEADS = os.environ.get(
    "COLA_LEADS", "/opt/data/proyectos/n8n/leads-pendientes.jsonl"
)

# Freno al spam del formulario: límite por IP y uno global (para no llenar el disco ni n8n).
# Lo que pase del límite responde 429 y no se guarda; el cliente igual sigue por WhatsApp.
LEADS_IP_10MIN = int(os.environ.get("LEADS_IP_10MIN", "5"))
LEADS_IP_DIA = int(os.environ.get("LEADS_IP_DIA", "20"))
LEADS_HORA = int(os.environ.get("LEADS_HORA", "120"))
# Campo trampa: invisible para las personas; si llega con texto, es un robot.
CAMPO_TRAMPA = "sitio_web"
REF_LEAD = re.compile(r"W-[A-Z0-9]{4}")
_envios_ip = {}   # ip -> [instantes de envío de las últimas 24 h]
_envios_todos = []  # instantes de envío de la última hora
_candado = threading.Lock()


def permitir_lead(ip, ahora=None):
    """Cuenta el envío si cabe en los límites. Devuelve False si hay que frenarlo."""
    ahora = time.time() if ahora is None else ahora
    with _candado:
        _envios_todos[:] = [t for t in _envios_todos if ahora - t < 3600]
        lista = [t for t in _envios_ip.get(ip, []) if ahora - t < 86400]
        if (len(_envios_todos) >= LEADS_HORA
                or len(lista) >= LEADS_IP_DIA
                or sum(1 for t in lista if ahora - t < 600) >= LEADS_IP_10MIN):
            _envios_ip[ip] = lista
            return False
        lista.append(ahora)
        _envios_ip[ip] = lista
        _envios_todos.append(ahora)
        # Limpieza: que el diccionario no crezca sin fin con IPs viejas.
        if len(_envios_ip) > 5000:
            for clave in [k for k, v in _envios_ip.items() if not v or ahora - v[-1] >= 86400]:
                del _envios_ip[clave]
        return True


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
        if ruta == RUTA_PRODUCTOS or FOTO_PRODUCTO.fullmatch(ruta):
            return self.tienda(ruta)
        return super().do_GET()

    def do_HEAD(self):
        ruta = self.path.split("?", 1)[0]
        if ruta.startswith(PREFIJO_ORDEN):
            return self.consultar_orden(ruta)
        if ruta == RUTA_PRODUCTOS or FOTO_PRODUCTO.fullmatch(ruta):
            return self.tienda(ruta)
        return super().do_HEAD()

    def tienda(self, ruta):
        """Puente con el catálogo del taller: la lista de productos o la foto de uno.

        El taller solo entrega lo disponible y sin costos ni existencias.
        """
        foto = FOTO_PRODUCTO.fullmatch(ruta)
        url = f"{TALLER}/api/public/productos/{foto.group(1)}/foto" if foto else f"{TALLER}/api/public/productos"
        tipo = "application/json; charset=utf-8"
        try:
            with urllib.request.urlopen(url, timeout=8) as resp:
                cuerpo, estado = resp.read(), resp.status
                tipo = resp.headers.get("Content-Type") or tipo
        except urllib.error.HTTPError as err:
            cuerpo, estado = b'{"error":"no encontrado"}', err.code
        except (urllib.error.URLError, OSError, TimeoutError):
            cuerpo, estado = b'{"error":"taller no disponible"}', 503
        if foto and estado == 200 and not tipo.startswith("image/"):
            cuerpo, estado, tipo = b'{"error":"no encontrado"}', 404, "application/json; charset=utf-8"
        # La foto se puede guardar un día (la URL cambia con ?v= al cambiar); la lista no se guarda:
        # así un producto nuevo o vendido se ve al instante en la tienda.
        self._cache = "public, max-age=86400" if (foto and estado == 200) else "no-store"
        self.send_response(estado)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(cuerpo)

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
        if not isinstance(datos, dict) or not REF_LEAD.fullmatch(str(datos.get("ref") or "")):
            cuerpo, estado = b'{"ok":false}', 400
        elif str(datos.get(CAMPO_TRAMPA) or "").strip():
            # Robot: se le responde como si nada para que no aprenda, pero no se guarda.
            sys.stderr.write("lead descartado: campo trampa (%s)\n" % self.ip_cliente())
            cuerpo, estado = b'{"ok":true}', 202
        elif not permitir_lead(self.ip_cliente()):
            sys.stderr.write("lead frenado: demasiados envios (%s)\n" % self.ip_cliente())
            cuerpo, estado = b'{"ok":false,"error":"demasiados envios"}', 429
        else:
            datos.pop(CAMPO_TRAMPA, None)
            cuerpo, estado = self.reenviar_lead(datos)
        self._api = True
        self.send_response(estado)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def ip_cliente(self):
        # Detrás de Cloudflare la IP real viene en CF-Connecting-IP (el servidor solo escucha en 127.0.0.1).
        return (self.headers.get("CF-Connecting-IP") or self.address_string())[:64]

    def reenviar_lead(self, datos):
        lead = {
            "recibido": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "origen": "tepcyc.com/reparacion",
            "ip": self.ip_cliente(),
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
        if getattr(self, "_cache", None):
            self.send_header("Cache-Control", self._cache)
        elif getattr(self, "_api", False) or getattr(self, "_es_404", False):
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
