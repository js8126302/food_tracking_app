# app/db.py
import os
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from bson.objectid import ObjectId
import certifi
from dotenv import load_dotenv

load_dotenv()

mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
db_name = os.getenv("MONGO_DB", "calorie_tracker")
collection_name = os.getenv("MONGO_COLLECTION", "daily_logs")

client_kwargs = {}
if mongo_uri.startswith("mongodb+srv://"):
    client_kwargs = {
        "tlsCAFile": certifi.where(),
        "server_api": ServerApi("1"),
    }

client = MongoClient(mongo_uri, **client_kwargs)

db = client[db_name]
collection = db[collection_name]

def check_connection() -> None:
    client.admin.command("ping")

def insert_log(log: dict):
    return collection.insert_one(log)

def get_all_logs():
    return list(collection.find())

def get_logs_summary():
    projection = {
        "_id": 0,
        "date": 1,
        "bodyWeightLbs": 1,
        "calorieIntakeKcal": 1,
        "appleWatchActiveCaloriesKcal": 1,
    }
    return list(collection.find({}, projection))

def get_log_by_id(log_id: str):
    return collection.find_one({"_id": ObjectId(log_id)})

def get_log_by_date(date_value: str):
    return collection.find_one({"date": date_value})

def delete_log_by_id(log_id: str):
    return collection.delete_one({"_id": ObjectId(log_id)})
