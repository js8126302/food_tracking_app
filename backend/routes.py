# app/routes.py
from fastapi import APIRouter, HTTPException, Request
import math
from bson.objectid import ObjectId
from analytics import (
    calculate_daily_summary, 
    calculate_daily_average
)

from db import (
    insert_log,
    get_all_logs,
    get_logs_summary,
    get_log_by_id,
    get_log_by_date,
    delete_log_by_id,
)
from analytics import serialize_doc
from typing import Dict, Any

router = APIRouter()


@router.post("/logs")
async def create_daily_log(log: Dict[str, Any]):
    date_value = log.get("date")
    if date_value:
        existing = get_log_by_date(date_value)
        if existing:
            raise HTTPException(status_code=409, detail="Log for this date already exists")
    result = insert_log(log)
    return {"inserted_id": str(result.inserted_id)}

@router.get("/logs")
def read_all_logs():
    return [serialize_doc(doc) for doc in get_all_logs()]

@router.get("/logs/summary")
def read_logs_summary():
    return get_logs_summary()

@router.get("/logs/{log_id}")
def read_log(log_id: str):
    try:
        log = get_log_by_id(log_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid log ID format")

    if not log:
        raise HTTPException(status_code=404, detail="Log not found")

    return serialize_doc(log)

@router.delete("/logs/{log_id}")
def delete_log(log_id: str):
    try:
        result = delete_log_by_id(log_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid log ID format")

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Log not found")

    return {"deleted": True}

 

@router.get("/data/get_daily_summary")
def get_daily_summary() -> list[dict]:
    logs = get_all_logs()
    result = calculate_daily_summary(logs, 72, 39, 'male')
    return result

@router.get("/data/get_daily_average")
def get_daily_average() -> dict:
    logs = get_all_logs()
    result = calculate_daily_average(logs, 72, 39, 'male')
    return result
    
    

    
    
