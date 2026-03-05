import requests

url = "http://127.0.0.1:8000/logs"

daily_log = {
  "date": "2026-02-15",
  "day_type": "Strength",
  "body_weight_lbs": 154,
  "totals": {
    "calories": 2034,
    "protein": 155,
    "carbs": 229,
    "fat": 40
  },
  "activity": {
    "active_calories": 1200,
    "source": "AppleWatch"
  },
  "health_metrics": {
    "blood_pressure_systolic": null,
    "blood_pressure_diastolic": null
  },
  "calculations": {
    "estimated_tdee": 2485,
    "calorie_deficit": 451
  },
  "notes": ""
},
response = requests.post(url, json=daily_log)
print(response.json())