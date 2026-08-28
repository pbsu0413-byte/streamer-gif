import json
import os
import random
from pathlib import Path

from flask import Flask, jsonify, render_template, request, abort

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
MEDIA_FILE = BASE_DIR / "data" / "media.json"
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")


def load_media():
    if not MEDIA_FILE.exists():
        return []
    with open(MEDIA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_media(items):
    MEDIA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(MEDIA_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def check_admin():
    if not ADMIN_PASSWORD:
        # 비밀번호를 설정하지 않았으면 관리 기능을 막아둔다 (안전을 위한 기본값)
        abort(401, description="ADMIN_PASSWORD 환경변수를 먼저 설정하세요.")
    pw = request.headers.get("X-Admin-Password", "")
    if pw != ADMIN_PASSWORD:
        abort(401, description="비밀번호가 올바르지 않습니다.")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/admin")
def admin_page():
    return render_template("admin.html")


@app.route("/api/media")
def api_media():
    return jsonify(load_media())


@app.route("/api/random")
def api_random():
    items = load_media()
    if not items:
        return jsonify({"error": "empty"}), 404
    return jsonify(random.choice(items))


@app.route("/api/media", methods=["POST"])
def add_media():
    check_admin()
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    url = (data.get("url") or "").strip()
    if not url:
        return jsonify({"error": "url is required"}), 400
    items = load_media()
    items.append({"name": name or "이름없음", "url": url})
    save_media(items)
    return jsonify({"ok": True, "items": items})


@app.route("/api/media/<int:index>", methods=["DELETE"])
def delete_media(index):
    check_admin()
    items = load_media()
    if 0 <= index < len(items):
        items.pop(index)
        save_media(items)
        return jsonify({"ok": True, "items": items})
    return jsonify({"error": "not found"}), 404


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
