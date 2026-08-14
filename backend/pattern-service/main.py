from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import os
import json
from datetime import datetime
from azure.storage.blob import BlobServiceClient
import requests

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== AZURE SETUP =====
AZURE_CONNECTION_STRING = os.getenv("AZURE_CONNECTION_STRING", "")
CONTAINER_IMAGES = "pattern-images"
CONTAINER_DATA = "pattern-data"
blob_service = None
container_images = None
container_data = None
ACCOUNT_NAME = ""

if AZURE_CONNECTION_STRING:
    blob_service = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
    container_images = blob_service.get_container_client(CONTAINER_IMAGES)
    container_data = blob_service.get_container_client(CONTAINER_DATA)
    try:
        container_images.create_container()
        print("✅ pattern-images container ready")
    except:
        pass
    try:
        container_data.create_container()
        print("✅ pattern-data container ready")
    except:
        pass
    ACCOUNT_NAME = AZURE_CONNECTION_STRING.split("AccountName=")[1].split(";")[0]

# ===== LOCAL FALLBACK =====
os.makedirs("images", exist_ok=True)
app.mount("/images", StaticFiles(directory="images"), name="images")

# ===== DATA =====
patterns = []
id_counter = 1

DEFAULT_IMAGE = "/images/0.jpg"
if ACCOUNT_NAME:
    DEFAULT_IMAGE = f"https://{ACCOUNT_NAME}.blob.core.windows.net/{CONTAINER_IMAGES}/0.jpg"

def load_patterns():
    global patterns, id_counter
    if not container_data:
        return
    try:
        blob = container_data.get_blob_client("patterns.json")
        data = blob.download_blob().readall()
        backup = json.loads(data)
        patterns = backup.get("patterns", [])
        id_counter = backup.get("id_counter", 1)
        print(f"✅ Loaded {len(patterns)} patterns from Azure")
    except:
        print("ℹ️ No existing patterns in Azure")

def save_patterns():
    if not container_data:
        return
    try:
        backup = {"patterns": patterns, "id_counter": id_counter, "backup_date": datetime.now().isoformat()}
        blob = container_data.get_blob_client("patterns.json")
        blob.upload_blob(json.dumps(backup), overwrite=True)
        print(f"✅ Saved {len(patterns)} patterns to Azure")
    except Exception as e:
        print(f"⚠️ Failed to save patterns: {e}")

# ===== SAMPLE PATTERNS =====
sample_patterns = [
    {"id": 1, "title": "Cozy Beanie", "description": "A very cute crochet beanie", "craft_type": "crochet", "skill_level": "beginner", "category": "accessories", "price": 4.99, "seller_id": 1, "image_url": DEFAULT_IMAGE, "pattern_details": "Chain 40. Row 1: SC in each stitch."},
    {"id": 2, "title": "Square Blanket", "description": "Square blanket for cold winter days", "craft_type": "crochet", "skill_level": "beginner", "category": "home", "price": 6.99, "seller_id": 1, "image_url": DEFAULT_IMAGE, "pattern_details": "Make 12 granny squares. Join all squares."},
    {"id": 3, "title": "Amigurumi Bear", "description": "Cutest amigurumi bear ever!!!", "craft_type": "crochet", "skill_level": "intermediate", "category": "toys", "price": 8.99, "seller_id": 2, "image_url": DEFAULT_IMAGE, "pattern_details": "Magic ring: 6 SC. Increase to 12, 18, 24."},
    {"id": 4, "title": "Cable Knit Sweater", "description": "Must have for all fashion girlies!", "craft_type": "knit", "skill_level": "advanced", "category": "garments", "price": 12.99, "seller_id": 3, "image_url": DEFAULT_IMAGE, "pattern_details": "Cast on 120. Ribbing: K2, P2 for 3 inches."},
    {"id": 5, "title": "Lace Shawl", "description": "For the classy ladies who love crochet and knit", "craft_type": "both", "skill_level": "advanced", "category": "accessories", "price": 0, "seller_id": 1, "image_url": DEFAULT_IMAGE, "pattern_details": "Cast on 5. Row 1: K1, YO, K1."},
    {"id": 6, "title": "Crochet bottle holder", "description": "Customize your boring water bottle!", "craft_type": "crochet", "skill_level": "beginner", "category": "accessories", "price": 0, "seller_id": 2, "image_url": DEFAULT_IMAGE, "pattern_details": "Chain 10. Row 1: SC in 2nd chain."}
]

load_patterns()

if not patterns:
    patterns = sample_patterns.copy()
    id_counter = 7
    save_patterns()
    print("✅ Default patterns saved to Azure")

USER_SERVICE_URL = "http://user-service:8080"

def get_seller_name(seller_id):
    try:
        response = requests.get(f"{USER_SERVICE_URL}/api/users/{seller_id}")
        if response.status_code == 200:
            user = response.json()
            return user.get("username", "Unknown")
        return "Unknown"
    except:
        return "Unknown"

class PatternCreate(BaseModel):
    title: str
    description: str
    price: float = 0
    seller_id: int
    image_url: Optional[str] = ""
    pattern_details: str
    craft_type: str = "crochet"
    skill_level: str = "beginner"
    category: str = "accessories"

@app.post("/api/patterns/upload-image/{pattern_id}")
async def upload_image(pattern_id: int, file: UploadFile = File(...)):
    if container_images:
        ext = file.filename.split(".")[-1]
        blob_name = f"{pattern_id}.{ext}"
        content = await file.read()
        blob = container_images.get_blob_client(blob_name)
        blob.upload_blob(content, overwrite=True)
        return {"image_url": f"https://{ACCOUNT_NAME}.blob.core.windows.net/{CONTAINER_IMAGES}/{blob_name}"}
    else:
        ext = file.filename.split(".")[-1]
        path = os.path.join("images", f"{pattern_id}.{ext}")
        with open(path, "wb") as f:
            f.write(await file.read())
        return {"image_url": f"/images/{pattern_id}.{ext}"}

@app.get("/health")
async def health():
    return {"status": "healthy", "patterns_count": len(patterns)}

@app.get("/api/patterns")
async def get_patterns():
    result = []
    for p in patterns:
        p_copy = p.copy()
        p_copy["seller_name"] = get_seller_name(p["seller_id"])
        if not p_copy.get("image_url") or p_copy["image_url"] == "":
            p_copy["image_url"] = DEFAULT_IMAGE
        result.append(p_copy)
    return result

@app.get("/api/patterns/{pattern_id}")
async def get_pattern(pattern_id: int):
    for p in patterns:
        if p["id"] == pattern_id:
            p_copy = p.copy()
            p_copy["seller_name"] = get_seller_name(p["seller_id"])
            if not p_copy.get("image_url") or p_copy["image_url"] == "":
                p_copy["image_url"] = DEFAULT_IMAGE
            return p_copy
    raise HTTPException(404, "Pattern not found")

@app.post("/api/patterns")
async def create_pattern(pattern: PatternCreate):
    global id_counter
    new_pattern = pattern.dict()
    new_pattern["id"] = id_counter
    id_counter += 1
    if not new_pattern.get("image_url") or new_pattern["image_url"] == "":
        new_pattern["image_url"] = DEFAULT_IMAGE
    patterns.append(new_pattern)
    save_patterns()
    result = new_pattern.copy()
    result["seller_name"] = get_seller_name(new_pattern["seller_id"])
    return result

@app.put("/api/patterns/{pattern_id}")
async def update_pattern(pattern_id: int, pattern_update: dict):
    global patterns
    for i, p in enumerate(patterns):
        if p["id"] == pattern_id:
            for key, value in pattern_update.items():
                if key in p:
                    p[key] = value
            save_patterns()
            return p
    raise HTTPException(404, "Pattern not found")

@app.delete("/api/patterns/{pattern_id}")
async def delete_pattern(pattern_id: int):
    global patterns
    for i, p in enumerate(patterns):
        if p["id"] == pattern_id:
            patterns.pop(i)
            save_patterns()
            return {"message": "Deleted"}
    raise HTTPException(404, "Pattern not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8081)