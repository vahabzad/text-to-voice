import argparse
import json
import os
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).resolve().parent
DEFAULT_PIPER = ROOT / "piper" / "piper.exe"
DEFAULT_MODEL = ROOT / "models" / "fa_IR-gyro-medium.onnx"
ALLOWED_MODELS = {
    "gyro": "fa_IR-gyro-medium.onnx",
    "amir": "fa_IR-amir-medium.onnx",
    "ganji": "fa_IR-ganji-medium.onnx",
    "ganji_adabi": "fa_IR-ganji_adabi-medium.onnx",
    "reza_ibrahim": "fa_IR-reza_ibrahim-medium.onnx",
}


class TtsHandler(BaseHTTPRequestHandler):
    server_version = "SelectedTextReaderLocalTTS/1.0"

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            self._send_json({"ok": True})
            return

        self.send_error(404)

    def do_POST(self):
        parsed_url = urlparse(self.path)
        if parsed_url.path != "/speak":
            self.send_error(404)
            return

        try:
            payload = self._read_json()
            text = normalize_text(payload.get("text", ""))
            if not text:
                self._send_json({"ok": False, "error": "NO_TEXT"}, status=400)
                return

            query = parse_qs(parsed_url.query)
            requested_model = payload.get("model") or first_query_value(query, "model")
            model_path = pick_model_path(requested_model, self.server.model_path)
            print(f"Using model: {model_path.name}")
            wav = synthesize(text, self.server.piper_path, model_path)
            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "audio/wav")
            self.send_header("X-TTS-Model", model_path.stem)
            self.send_header("Content-Length", str(len(wav)))
            self.end_headers()
            self.wfile.write(wav)
        except FileNotFoundError as error:
            self._send_json({"ok": False, "error": str(error)}, status=500)
        except subprocess.CalledProcessError as error:
            message = error.stderr.decode("utf-8", errors="replace").strip()
            self._send_json({"ok": False, "error": message or "PIPER_FAILED"}, status=500)
        except Exception as error:
            self._send_json({"ok": False, "error": str(error)}, status=500)

    def log_message(self, format, *args):
        print("%s - %s" % (self.address_string(), format % args))

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        return json.loads(body.decode("utf-8"))

    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")


def normalize_text(text):
    return " ".join(str(text).split())


def synthesize(text, piper_path, model_path):
    if not piper_path.exists():
        raise FileNotFoundError(f"Piper executable not found: {piper_path}")

    if not model_path.exists():
        raise FileNotFoundError(f"Piper Persian model not found: {model_path}")

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as output:
        output_path = Path(output.name)

    try:
        subprocess.run(
            [str(piper_path), "--model", str(model_path), "--output_file", str(output_path)],
            input=text.encode("utf-8"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        )
        return output_path.read_bytes()
    finally:
        try:
            output_path.unlink()
        except OSError:
            pass


def pick_model_path(model_name, fallback_path):
    model_file = ALLOWED_MODELS.get(str(model_name))
    if not model_file:
        return fallback_path

    return ROOT / "models" / model_file


def first_query_value(query, key):
    values = query.get(key) or []
    return values[0] if values else ""


def main():
    parser = argparse.ArgumentParser(description="Local Persian TTS helper for Selected Text Reader.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8765, type=int)
    parser.add_argument("--piper", default=os.environ.get("PIPER_PATH", str(DEFAULT_PIPER)))
    parser.add_argument("--model", default=os.environ.get("PIPER_MODEL", str(DEFAULT_MODEL)))
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), TtsHandler)
    server.piper_path = Path(args.piper)
    server.model_path = Path(args.model)

    print(f"Local TTS helper listening on http://{args.host}:{args.port}")
    print(f"Piper: {server.piper_path}")
    print(f"Model: {server.model_path}")
    server.serve_forever()


if __name__ == "__main__":
    main()
