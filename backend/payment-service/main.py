from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import os
import json
import httpx
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
CONTAINER_NAME = "payment-data"
blob_service = None
container_client = None

if AZURE_CONNECTION_STRING:
    blob_service = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
    container_client = blob_service.get_container_client(CONTAINER_NAME)
    try:
        container_client.create_container()
        print("payment-data container ready")
    except:
        pass


purchases = []
id_counter = 1

#load

def load_purchases():
    global purchases, id_counter
    if not container_client:
        return
    try:
        blob = container_client.get_blob_client("purchases.json")
        data = blob.download_blob().readall()
        backup = json.loads(data)
        purchases = backup.get("purchases", [])
        id_counter = backup.get("id_counter", 1)
        print("loaded purchases from azure")
    except:
        print("no purchases found in azure")


#save

def save_purchases():
    if not container_client:
        return
    try:
        backup = {"purchases": purchases, "id_counter": id_counter, "backup_date": datetime.now().isoformat()}
        blob = container_client.get_blob_client("purchases.json")
        blob.upload_blob(json.dumps(backup), overwrite=True)
        print("savedpurchases to azure")
    except Exception as e:
        print(f"failed to save purchases: {e}")

load_purchases()

if not purchases:
    purchases = []
    id_counter = 1
    save_purchases()
    print("empty purchase file")

class PurchaseCreate(BaseModel):
    user_id: int
    pattern_id: int
    amount: float = 0

@app.get("/health")
async def health():
    return {"status": "healthy", "purchases": len(purchases)}

@app.post("/api/payments/purchase")
async def purchase_pattern(purchase_data: PurchaseCreate):
    global id_counter
    
    for p in purchases:
        if p["user_id"] == purchase_data.user_id and p["pattern_id"] == purchase_data.pattern_id:
            raise HTTPException(400, "Already purchased")
    
    balance = 0
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            user_response = await client.get(f"https://user-service-0cbz.onrender.com/api/users/{purchase_data.user_id}")
            if user_response.status_code == 200:
                user = user_response.json()
                current_balance = user.get("wallet", 0)
                
                if purchase_data.amount > 0 and current_balance < purchase_data.amount:
                    raise HTTPException(400, "Insufficient funds")
                
                if purchase_data.amount > 0:
                    deduct_response = await client.post(
                        f"https://user-service-0cbz.onrender.com/api/users/{purchase_data.user_id}/wallet/deduct",
                        json={"amount": purchase_data.amount}
                    )
                    if deduct_response.status_code == 200:
                        balance = deduct_response.json().get("balance", 0)
                    else:
                        balance = current_balance
                else:
                    balance = current_balance
            else:
                balance = 0
    except Exception as e:
        print(f"Error: {e}")
        balance = 0
    
    new_purchase = {
        "id": id_counter,
        "user_id": purchase_data.user_id,
        "pattern_id": purchase_data.pattern_id,
        "amount": purchase_data.amount,
        "purchased_at": datetime.now().isoformat()
    }
    purchases.append(new_purchase)
    id_counter += 1
    save_purchases()
    
    return {
        "success": True,
        "balance": balance,
        "purchase": new_purchase
    }

@app.get("/api/payments/purchases/{user_id}")
async def get_purchases(user_id: int):
    user_purchases = [p for p in purchases if p["user_id"] == user_id]
    return {"purchases": user_purchases}

@app.get("/api/payments/purchases/all")
async def get_all_purchases():
    return {"purchases": purchases}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8083)