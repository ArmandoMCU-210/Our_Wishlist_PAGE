import hmac
import os
from datetime import datetime, timezone

import certifi
import cloudinary
import cloudinary.uploader
from bson import ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from pymongo import MongoClient

load_dotenv()

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB por foto

client = MongoClient(os.environ["MONGO_URI"], tlsCAFile=certifi.where())
db = client[os.environ.get("MONGO_DB_NAME", "our_wishlist")]
gifts_col = db.gifts

cloudinary.config(
    cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
    api_key=os.environ["CLOUDINARY_API_KEY"],
    api_secret=os.environ["CLOUDINARY_API_SECRET"],
    secure=True,
)

DELIVER_PASSWORD = os.environ["DELIVER_PASSWORD"]

IMPORTANCE_LEVELS = ["Me gustaría", "Lo quiero", "Muchísimo"]
IMPORTANCE_ORDER = {name: i for i, name in enumerate(IMPORTANCE_LEVELS)}
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}


def serialize(doc):
    return {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "description": doc.get("description", ""),
        "purchase_link": doc.get("purchase_link", ""),
        "store": doc.get("store", ""),
        "importance": doc["importance"],
        "image_url": doc["image_url"],
        "delivered": doc.get("delivered", False),
        "delivered_at": doc["delivered_at"].isoformat() if doc.get("delivered_at") else None,
        "created_at": doc["created_at"].isoformat(),
    }


def to_object_id(gift_id):
    try:
        return ObjectId(gift_id)
    except (InvalidId, TypeError):
        return None


def upload_image(file_storage):
    result = cloudinary.uploader.upload(
        file_storage,
        folder="our_wishlist",
        transformation=[{"width": 1200, "height": 1200, "crop": "limit", "quality": "auto"}],
    )
    return result["secure_url"], result["public_id"]


@app.route("/")
def index():
    return render_template("index.html", importance_levels=IMPORTANCE_LEVELS)


@app.route("/api/gifts", methods=["GET"])
def list_gifts():
    query = {}

    search = request.args.get("search", "").strip()
    if search:
        query["name"] = {"$regex": search, "$options": "i"}

    importance = request.args.get("importance", "").strip()
    if importance in IMPORTANCE_ORDER:
        query["importance"] = importance

    delivered = request.args.get("delivered", "").strip()
    if delivered == "true":
        query["delivered"] = True
    elif delivered == "false":
        query["delivered"] = {"$ne": True}

    docs = list(gifts_col.find(query))

    sort_by = request.args.get("sort", "created_desc")
    if sort_by == "created_asc":
        docs.sort(key=lambda d: d["created_at"])
    elif sort_by == "importance_desc":
        docs.sort(key=lambda d: (IMPORTANCE_ORDER.get(d["importance"], 0), d["created_at"]), reverse=True)
    elif sort_by == "importance_asc":
        docs.sort(key=lambda d: (IMPORTANCE_ORDER.get(d["importance"], 0), d["created_at"]))
    else:
        docs.sort(key=lambda d: d["created_at"], reverse=True)

    return jsonify([serialize(d) for d in docs])


@app.route("/api/gifts", methods=["POST"])
def create_gift():
    name = request.form.get("name", "").strip()
    importance = request.form.get("importance", "").strip()
    image = request.files.get("image")

    if not name:
        return jsonify({"error": "Cuéntame cómo se llama esa cosita, mi amor."}), 400
    if importance not in IMPORTANCE_ORDER:
        return jsonify({"error": "Dime cuánto deseas este regalo 💕"}), 400
    if not image or image.filename == "":
        return jsonify({"error": "Necesito una fotito de esa cosita 💗"}), 400
    if image.mimetype not in ALLOWED_IMAGE_TYPES:
        return jsonify({"error": "Ese formato de imagen no es compatible, intenta con otra foto."}), 400

    image_url, image_public_id = upload_image(image)

    doc = {
        "name": name,
        "description": request.form.get("description", "").strip(),
        "purchase_link": request.form.get("purchase_link", "").strip(),
        "store": request.form.get("store", "").strip(),
        "importance": importance,
        "image_url": image_url,
        "image_public_id": image_public_id,
        "delivered": False,
        "delivered_at": None,
        "created_at": datetime.now(timezone.utc),
    }
    result = gifts_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return jsonify(serialize(doc)), 201


@app.route("/api/gifts/<gift_id>", methods=["PUT"])
def update_gift(gift_id):
    oid = to_object_id(gift_id)
    doc = gifts_col.find_one({"_id": oid}) if oid else None
    if not doc:
        return jsonify({"error": "No encontré esa cosita, mi amor."}), 404

    name = request.form.get("name", "").strip()
    importance = request.form.get("importance", "").strip()
    if not name:
        return jsonify({"error": "Cuéntame cómo se llama esa cosita, mi amor."}), 400
    if importance not in IMPORTANCE_ORDER:
        return jsonify({"error": "Dime cuánto deseas este regalo 💕"}), 400

    update = {
        "name": name,
        "description": request.form.get("description", "").strip(),
        "purchase_link": request.form.get("purchase_link", "").strip(),
        "store": request.form.get("store", "").strip(),
        "importance": importance,
    }

    image = request.files.get("image")
    if image and image.filename != "":
        if image.mimetype not in ALLOWED_IMAGE_TYPES:
            return jsonify({"error": "Ese formato de imagen no es compatible, intenta con otra foto."}), 400
        old_public_id = doc.get("image_public_id")
        update["image_url"], update["image_public_id"] = upload_image(image)
        if old_public_id:
            cloudinary.uploader.destroy(old_public_id)

    gifts_col.update_one({"_id": oid}, {"$set": update})
    doc = gifts_col.find_one({"_id": oid})
    return jsonify(serialize(doc))


@app.route("/api/gifts/<gift_id>", methods=["DELETE"])
def delete_gift(gift_id):
    oid = to_object_id(gift_id)
    doc = gifts_col.find_one({"_id": oid}) if oid else None
    if not doc:
        return jsonify({"error": "No encontré esa cosita, mi amor."}), 404

    if doc.get("image_public_id"):
        cloudinary.uploader.destroy(doc["image_public_id"])
    gifts_col.delete_one({"_id": oid})
    return "", 204


@app.route("/api/gifts/<gift_id>/delivery", methods=["POST"])
def set_delivery(gift_id):
    oid = to_object_id(gift_id)
    doc = gifts_col.find_one({"_id": oid}) if oid else None
    if not doc:
        return jsonify({"error": "No encontré esa cosita, mi amor."}), 404

    data = request.get_json(silent=True) or {}
    password = data.get("password", "")
    if not hmac.compare_digest(password, DELIVER_PASSWORD):
        return jsonify({"error": "Esa no es la contraseña correcta, mi amor 🔒"}), 403

    delivered = bool(data.get("delivered", True))
    update = {"delivered": delivered}
    update["delivered_at"] = datetime.now(timezone.utc) if delivered else None

    gifts_col.update_one({"_id": oid}, {"$set": update})
    doc = gifts_col.find_one({"_id": oid})
    return jsonify(serialize(doc))


if __name__ == "__main__":
    app.run(debug=True)
