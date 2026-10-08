"""Kleiner Server zum Ausprobieren von HK Klempner am eigenen Rechner.

Aufruf:  python werkzeug/server.py [port] [--oeffnen]
Mit --oeffnen geht der Browser gleich mit auf. Nur für die Entwicklung gedacht.
"""
import http.server
import pathlib
import sys
import threading
import webbrowser

WURZEL = pathlib.Path(__file__).resolve().parent.parent


class Handler(http.server.SimpleHTTPRequestHandler):
    # Windows liefert .js sonst je nach Registry als text/plain aus, dann laden die Module nicht.
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".html": "text/html; charset=utf-8",
        ".json": "application/json",
        ".woff2": "font/woff2",
        ".svg": "image/svg+xml",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WURZEL), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Server(http.server.ThreadingHTTPServer):
    # Sonst lässt Windows zwei Server auf demselben Port zu, und der zweite Start fällt nicht auf.
    allow_reuse_address = False


def main():
    zahlen = [a for a in sys.argv[1:] if a.isdigit()]
    port = int(zahlen[0]) if zahlen else 8765
    adresse = f"http://localhost:{port}"
    try:
        server = Server(("127.0.0.1", port), Handler)
    except OSError:
        # Port belegt: dann läuft HK Klempner meist schon in einem anderen Fenster.
        print(f"Port {port} ist belegt. HK Klempner läuft vermutlich schon: {adresse}")
        if "--oeffnen" in sys.argv:
            webbrowser.open(adresse)
        return
    with server:
        print(f"HK Klempner läuft auf {adresse}")
        print("Dieses Fenster offen lassen. Zum Beenden das Fenster schließen.")
        if "--oeffnen" in sys.argv:
            threading.Timer(0.5, webbrowser.open, [adresse]).start()
        server.serve_forever()


if __name__ == "__main__":
    main()
