from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import os
import json
from azure.storage.blob import BlobServiceClient

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
CONTAINER_NAME = "community-data"
blob_service = None
container_client = None

if AZURE_CONNECTION_STRING:
    blob_service = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
    container_client = blob_service.get_container_client(CONTAINER_NAME)
    try:
        container_client.create_container()
    except:
        pass

# ===== DATA =====
posts = []
id_counter = 1

# ===== LOAD FROM AZURE =====
def load_posts():
    global posts, id_counter
    if not container_client:
        return
    try:
        blob = container_client.get_blob_client("posts.json")
        data = blob.download_blob().readall()
        backup = json.loads(data)
        posts = backup.get("posts", [])
        id_counter = backup.get("id_counter", 1)
        print(f"✅ Loaded {len(posts)} posts from Azure")
    except:
        print("ℹ️ No existing posts in Azure, using defaults")

# ===== SAVE TO AZURE =====
def save_posts():
    if not container_client:
        return
    try:
        backup = {"posts": posts, "id_counter": id_counter, "backup_date": datetime.now().isoformat()}
        blob = container_client.get_blob_client("posts.json")
        blob.upload_blob(json.dumps(backup), overwrite=True)
        print(f"✅ Saved {len(posts)} posts to Azure")
    except Exception as e:
        print(f"⚠️ Failed to save posts: {e}")

# ===== SAMPLE POSTS =====
posts = [
    {"id": 1, "user_id": 1, "username": "Sarah", "title": "Tips for beginners?", "content": "Any tips on consistent tension?", "likes": 5, "liked_by": [1, 2, 3], "comments": [], "created_at": "2024-01-20T10:00:00"},
    {"id": 2, "user_id": 2, "username": "Maker", "title": "Favorite yarn brands?", "content": "What's your favorite yarn for amigurumi?", "likes": 3, "liked_by": [1, 2], "comments": [], "created_at": "2024-01-19T14:30:00"}
]
id_counter = 3
load_posts()

class PostCreate(BaseModel):
    user_id: int
    username: str
    title: str
    content: str

class CommentCreate(BaseModel):
    user_id: int
    username: str
    content: str

def find_post_by_id(post_id):
    for post in posts:
        if post["id"] == post_id:
            return post
    return None

@app.get("/health")
async def health():
    return {"status": "healthy", "posts": len(posts)}

@app.get("/api/community/posts")
async def get_posts():
    result = []
    for p in posts:
        p_copy = p.copy()
        p_copy.pop("liked_by", None)
        result.append(p_copy)
    return result

@app.post("/api/community/posts")
async def create_post(post_data: PostCreate):
    global id_counter
    new_post = {
        "id": id_counter,
        "user_id": post_data.user_id,
        "username": post_data.username,
        "title": post_data.title,
        "content": post_data.content,
        "likes": 0,
        "liked_by": [],
        "comments": [],
        "created_at": datetime.now().isoformat()
    }
    posts.append(new_post)
    id_counter += 1
    save_posts()
    result = new_post.copy()
    result.pop("liked_by", None)
    return result

@app.post("/api/community/posts/{post_id}/toggle-like")
async def toggle_like(post_id: int, user_id: int):
    post = find_post_by_id(post_id)
    if not post:
        raise HTTPException(404, "Post not found")
    
    if user_id in post["liked_by"]:
        post["liked_by"].remove(user_id)
        post["likes"] -= 1
        save_posts()
        return {"success": True, "liked": False, "likes": post["likes"]}
    else:
        post["liked_by"].append(user_id)
        post["likes"] += 1
        save_posts()
        return {"success": True, "liked": True, "likes": post["likes"]}

@app.post("/api/community/posts/{post_id}/comment")
async def add_comment(post_id: int, comment_data: CommentCreate):
    post = find_post_by_id(post_id)
    if not post:
        raise HTTPException(404, "Post not found")
    
    comment = {
        "user_id": comment_data.user_id,
        "username": comment_data.username,
        "content": comment_data.content,
        "created_at": datetime.now().isoformat()
    }
    post["comments"].append(comment)
    save_posts()
    result = post.copy()
    result.pop("liked_by", None)
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8082)