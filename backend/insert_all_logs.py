import requests
import json

url = "http://127.0.0.1:8000/logs"  # your running FastAPI server

# Load the array of daily logs from data.txt
with open("data.txt", "r") as f:
    daily_logs = json.load(f)  # assumes data.txt contains valid JSON array

# Insert each log
for log in daily_logs:
    response = requests.post(url, json=log)
    if response.status_code == 200:
        print(f"Inserted log for date {log.get('date')} | ID: {response.json()['inserted_id']}")
    else:
        print(f"Failed to insert log for date {log.get('date')} | Response: {response.text}")