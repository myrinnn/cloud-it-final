from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import json
from datetime import datetime
from azure.storage.blob import BlobServiceClient

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# azure

AZURE_CONNECTION_STRING = os.getenv("AZURE_CONNECTION_STRING", "")
CONTAINER_NAME = "user-data"
blob_service = None
container_client = None

if AZURE_CONNECTION_STRING:
    blob_service = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
    container_client = blob_service.get_container_client(CONTAINER_NAME)
    try:
        container_client.create_container()
        print("user-data container ready")
    except:
        pass

users = []
id_counter = 1

#load

def load_users():
    global users, id_counter
    if not container_client:
        return
    try:
        blob = container_client.get_blob_client("users.json")
        data = blob.download_blob().readall()
        backup = json.loads(data)
        users = backup.get("users", [])
        id_counter = backup.get("id_counter", 1)
        print("loaded users from azure")
    except:
        print("no users found in azure")

def save_users():
    if not container_client:
        return
    try:
        backup = {"users": users, "id_counter": id_counter, "backup_date": datetime.now().isoformat()}
        blob = container_client.get_blob_client("users.json")
        blob.upload_blob(json.dumps(backup), overwrite=True)
        print("saved users to azure")
    except Exception as e:
        print(f"failed to save users: {e}")

load_users()
#sample users

if not users:
    users = [
        {"id": 1, "username": "Sarah", "password": "password", "wallet": 10.00, "is_seller": True},
        {"id": 2, "username": "Fiona", "password": "password", "wallet": 10.00, "is_seller": False},
        {"id": 3, "username": "Jane", "password": "password", "wallet": 10.00, "is_seller": False}
    ]
    id_counter = 4
    save_users()
    print("✅ Default users saved to Azure")


class UserRegister(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class AddFunds(BaseModel):
    amount: float

class DeductFunds(BaseModel):
    amount: float

def find_user_by_username(username):
    for user in users:
        if user["username"] == username:
            return user
    return None

def find_user_by_id(user_id):
    for user in users:
        if user["id"] == user_id:
            return user
    return None

@app.get("/health")
async def health():
    return {"status": "healthy", "users": len(users)}

@app.post("/api/auth/register")
async def register(user_data: UserRegister):
    global id_counter
    if find_user_by_username(user_data.username):
        raise HTTPException(409, "Username already taken")
    
    new_user = {
        "id": id_counter,
        "username": user_data.username,
        "password": user_data.password,
        "wallet": 10.00,
        "is_seller": False
    }
    users.append(new_user)
    id_counter += 1
    save_users()
    
    return {
        "success": True,
        "user": {
            "id": new_user["id"],
            "username": new_user["username"],
            "wallet": new_user["wallet"],
            "is_seller": new_user["is_seller"]
        }
    }

@app.post("/api/auth/login")
async def login(user_data: UserLogin):
    user = find_user_by_username(user_data.username)
    if not user:
        raise HTTPException(401, "User not found")
    if user["password"] != user_data.password:
        raise HTTPException(401, "Invalid password")
    
    return {
        "success": True,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "wallet": user["wallet"],
            "is_seller": user["is_seller"]
        }
    }

@app.get("/api/users/{user_id}")
async def get_user(user_id: int):
    user = find_user_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return {
        "id": user["id"],
        "username": user["username"],
        "wallet": user["wallet"],
        "is_seller": user["is_seller"]
    }

@app.post("/api/users/{user_id}/become-seller")
async def become_seller(user_id: int):
    user = find_user_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    user["is_seller"] = True
    save_users()
    return {"success": True, "is_seller": True}

@app.post("/api/users/{user_id}/wallet/add")
async def add_funds(user_id: int, data: AddFunds):
    user = find_user_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if data.amount <= 0:
        raise HTTPException(400, "Amount must be positive")
    user["wallet"] += data.amount
    save_users()
    return {"success": True, "balance": user["wallet"]}

@app.post("/api/users/{user_id}/wallet/deduct")
async def deduct_funds(user_id: int, data: DeductFunds):
    user = find_user_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if data.amount <= 0:
        raise HTTPException(400, "Amount must be positive")
    if user["wallet"] < data.amount:
        raise HTTPException(400, f"Insufficient funds. Balance: {user['wallet']}")
    user["wallet"] -= data.amount
    save_users()
    return {"success": True, "balance": user["wallet"]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)