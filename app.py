import base64
import json
import os
import random
from pathlib import Path

import cloudinary
import cloudinary.uploader
import requests
from flask import Flask, jsonify, render_template, request, abort

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
MEDIA_FILE = BASE_DIR / "data" / "media.json"
CATEGORIES_FILE = BASE_DIR / "data" / "categories.json"
CHANNELS_FILE = BASE_DIR / "data" / "channels.json"
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")

# 이 세 가지를 설정하면, 관리 페이지에서 짤/카테고리를 추가할 때마다
# 깃허브 저장소의 실제 파일에도 자동으로 커밋해서 재배포되어도 사라지지 않게 한다.
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "")  # 예: "myid/streamer-gif-app"
GITHUB_BRANCH = os.environ.get("GITHUB_BRANCH", "main")

# Cloudinary 설정 - 반드시 환경변수로만 관리한다 (코드에 직접 적지 말 것!)
CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.environ.get("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET", "")

if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True,
    )


def github_commit_file(path_in_repo, content_str, message):
    """data/media.json, data/categories.json 등을 깃허브 저장소에 직접 커밋한다.
    GITHUB_TOKEN / GITHUB_REPO가 설정되어 있지 않으면 그냥 아무것도 하지 않는다."""
    if not (GITHUB_TOKEN and GITHUB_REPO):
        return False
    api_url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{path_in_repo}"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
    }
    try:
        get_res = requests.get(api_url, headers=headers, params={"ref": GITHUB_BRANCH}, timeout=10)
        sha = get_res.json().get("sha") if get_res.status_code == 200 else None

        body = {
            "message": message,
            "content": base64.b64encode(content_str.encode("utf-8")).decode("utf-8"),
            "branch": GITHUB_BRANCH,
        }
        if sha:
            body["sha"] = sha

        put_res = requests.put(api_url, headers=headers, json=body, timeout=10)
        return put_res.status_code in (200, 201)
    except requests.RequestException:
        return False


def load_media():
    if not MEDIA_FILE.exists():
        return []
    with open(MEDIA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_media(items):
    MEDIA_FILE.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(items, ensure_ascii=False, indent=2)
    with open(MEDIA_FILE, "w", encoding="utf-8") as f:
        f.write(content)
    github_commit_file("data/media.json", content, "짤 목록 업데이트")


def load_categories():
    if not CATEGORIES_FILE.exists():
        return []
    with open(CATEGORIES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_categories(cats):
    CATEGORIES_FILE.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(cats, ensure_ascii=False, indent=2)
    with open(CATEGORIES_FILE, "w", encoding="utf-8") as f:
        f.write(content)
    github_commit_file("data/categories.json", content, "카테고리 업데이트")


def load_channels():
    if not CHANNELS_FILE.exists():
        return {}
    with open(CHANNELS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_channels(mapping):
    CHANNELS_FILE.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(mapping, ensure_ascii=False, indent=2)
    with open(CHANNELS_FILE, "w", encoding="utf-8") as f:
        f.write(content)
    github_commit_file("data/channels.json", content, "치지직 채널 연결 업데이트")


def check_admin():
    if not ADMIN_PASSWORD:
        # 비밀번호를 설정하지 않았으면 관리 기능을 막아둔다 (안전을 위한 기본값)
        abort(401, description="ADMIN_PASSWORD 환경변수를 먼저 설정하세요.")
    pw = request.headers.get("X-Admin-Password", "")
    if pw != ADMIN_PASSWORD:
        abort(401, description="비밀번호가 올바르지 않습니다.")


@app.route("/")
def index():
    return render_template("index.html", kakao_js_key=os.environ.get("KAKAO_JS_KEY", ""))


@app.route("/admin")
def admin_page():
    return render_template("admin.html")


@app.route("/api/media")
def api_media():
    items = load_media()
    category = request.args.get("category")
    if category:
        items = [i for i in items if i.get("category") == category]
    return jsonify(items)


@app.route("/api/random")
def api_random():
    items = load_media()
    category = request.args.get("category")
    if category:
        items = [i for i in items if i.get("category") == category]
    if not items:
        return jsonify({"error": "empty"}), 404
    return jsonify(random.choice(items))


@app.route("/api/media", methods=["POST"])
def add_media():
    check_admin()
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    url = (data.get("url") or "").strip()
    category = (data.get("category") or "").strip()
    if not url:
        return jsonify({"error": "url is required"}), 400
    items = load_media()
    items.append({
        "name": name or "이름없음",
        "url": url,
        "category": category or "미분류",
    })
    save_media(items)
    return jsonify({"ok": True, "items": items})


@app.route("/api/categories")
def api_categories():
    return jsonify(load_categories())


@app.route("/api/categories", methods=["POST"])
def add_category():
    check_admin()
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    cats = load_categories()
    if name not in cats:
        cats.append(name)
        save_categories(cats)
    return jsonify({"ok": True, "categories": cats})


@app.route("/api/categories/<name>", methods=["DELETE"])
def delete_category(name):
    check_admin()
    cats = load_categories()
    if name in cats:
        cats.remove(name)
        save_categories(cats)
    return jsonify({"ok": True, "categories": cats})


@app.route("/api/media/<int:index>", methods=["DELETE"])
def delete_media(index):
    check_admin()
    items = load_media()
    if 0 <= index < len(items):
        items.pop(index)
        save_media(items)
        return jsonify({"ok": True, "items": items})
    return jsonify({"error": "not found"}), 404


@app.route("/api/channels")
def api_channels():
    return jsonify(load_channels())


@app.route("/api/channels", methods=["POST"])
def set_channel():
    check_admin()
    data = request.get_json(silent=True) or {}
    category = (data.get("category") or "").strip()
    channel_id = (data.get("channel_id") or "").strip()
    if not category:
        return jsonify({"error": "category is required"}), 400
    # 채널 URL을 통째로 붙여넣었을 경우 뒤쪽 채널ID만 뽑아낸다
    if "chzzk.naver.com" in channel_id:
        channel_id = channel_id.split("?")[0].rstrip("/").split("/")[-1]
    mapping = load_channels()
    if channel_id:
        mapping[category] = channel_id
    else:
        mapping.pop(category, None)
    save_channels(mapping)
    return jsonify({"ok": True, "channels": mapping})


@app.route("/api/live-status/<category>")
def live_status(category):
    mapping = load_channels()
    channel_id = mapping.get(category)
    if not channel_id:
        return jsonify({"live": None})
    try:
        res = requests.get(
            f"https://api.chzzk.naver.com/polling/v2/channels/{channel_id}/live-status",
            timeout=6,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        data = res.json()
        content = data.get("content") or {}
        status = content.get("status")
        return jsonify({
            "live": status == "OPEN",
            "title": content.get("liveTitle"),
            "viewers": content.get("concurrentUserCount"),
        })
    except requests.RequestException as e:
        return jsonify({"live": None, "error": str(e)})


@app.route("/api/upload", methods=["POST"])
def upload_file():
    """관리 페이지에서 gif/이미지 파일을 직접 올리면 Cloudinary에 영구 저장하고
    그 주소(secure_url)를 돌려준다. Render 재배포와 무관하게 계속 살아있는 링크가 된다."""
    check_admin()
    if not (CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET):
        return jsonify({"error": "Cloudinary 환경변수(CLOUDINARY_CLOUD_NAME 등)가 설정되지 않았습니다."}), 500
    if "image" not in request.files:
        return jsonify({"error": "파일이 없습니다."}), 400
    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "선택된 파일이 없습니다."}), 400
    try:
        result = cloudinary.uploader.upload(
            file,
            folder="streamer-gifs",
            resource_type="auto",
        )
        return jsonify({"ok": True, "url": result.get("secure_url")})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
