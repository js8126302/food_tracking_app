# app/analytics.py
import math

# -----------------------------
# Helpers
# -----------------------------

def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB _id to string."""
    doc["_id"] = str(doc["_id"])
    return doc


def impute_body_weight(logs: list[dict]) -> list[dict]:
    """
    Fill missing bodyWeightLbs by averaging nearest previous and next known weights.
    Assumes logs are sorted by date ascending.
    """
    for i, log in enumerate(logs):
        if log.get("bodyWeightLbs") is None:
            # Previous known weight
            prev_weight = next((logs[j]["bodyWeightLbs"] for j in range(i-1, -1, -1) if logs[j].get("bodyWeightLbs") is not None), None)
            # Next known weight
            next_weight = next((logs[j]["bodyWeightLbs"] for j in range(i+1, len(logs)) if logs[j].get("bodyWeightLbs") is not None), None)
            # Impute
            if prev_weight is not None and next_weight is not None:
                log["bodyWeightLbs"] = (prev_weight + next_weight) / 2
            elif prev_weight is not None:
                log["bodyWeightLbs"] = prev_weight
            elif next_weight is not None:
                log["bodyWeightLbs"] = next_weight
            else:
                log["bodyWeightLbs"] = 0
    return logs


def calculate_bmr(weight_lbs: float, height_in: float, age: int, sex: str) -> float:
    """Mifflin-St Jeor BMR formula. Returns kcal/day."""
    if not weight_lbs or not height_in or not age or sex not in ("male", "female"):
        return 0.0
    weight_kg = weight_lbs * 0.453592
    height_cm = height_in * 2.54
    if sex == "male":
        return 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    else:
        return 10 * weight_kg + 6.25 * height_cm - 5 * age - 161


# -----------------------------
# Deficit Calculations
# -----------------------------

def get_daily_deficit(log: dict) -> float:
    """
    Returns deficit where positive means calories burned > consumed.
    Apple Watch overestimation factor 0.7 applied.
    """
    consumed = log.get("calorieIntakeKcal") or 0
    burned = log.get("appleWatchActiveCaloriesKcal") or 0
    return -(consumed - 0.7 * burned)


def get_deficit_data(logs: list[dict]) -> list[dict]:
    """Returns list of dicts: {date, deficit}"""
    return [{"date": log.get("date"), "deficit": get_daily_deficit(log)} for log in logs]


def average_calories_deficit(logs: list[dict]) -> float:
    if not logs:
        return 0.0
    total = sum(get_daily_deficit(log) for log in logs)
    return total / len(logs)


# -----------------------------
# Calories & Protein
# -----------------------------

def average_calories_burned(logs: list[dict]) -> float:
    if not logs:
        return 0.0
    total = sum(log.get("appleWatchActiveCaloriesKcal") or 0 for log in logs)
    return total / len(logs)


def average_calories_consumed(logs: list[dict]) -> float:
    if not logs:
        return 0.0
    total = sum(log.get("calorieIntakeKcal") or 0 for log in logs)
    return total / len(logs)


def get_protein_intake(log: dict) -> float:
    return log.get("proteinGrams") or 0.0


# -----------------------------
# Daily Summary & Averages
# -----------------------------

def calculate_daily_summary(logs: list[dict], height_in: int, age: int, sex: str) -> list[dict]:
    """Return daily summary with BMR, deficit, protein, etc."""
    if not logs:
        return []

    logs = sorted(logs, key=lambda x: x.get("date"))
    logs = impute_body_weight(logs)
    result = []

    for log in logs:
        weight = log.get("bodyWeightLbs") or 0
        intake = log.get("calorieIntakeKcal") or 0
        active = log.get("appleWatchActiveCaloriesKcal") or 0
        protein = get_protein_intake(log)
        bmr = calculate_bmr(weight, height_in, age, sex)
        deficit = -(intake - (bmr + active * 0.7))  # positive if burned > consumed

        result.append({
            "date": log.get("date"),
            "bodyWeight": weight,
            "BMR": math.floor(bmr),
            "calorieIntake": intake,
            "activeCalories": active,
            "deficit": math.floor(deficit),
            "proteinIntake": math.floor(protein)
        })

    return result


def calculate_daily_average(logs: list[dict], height_in: int, age: int, sex: str) -> dict:
    """Return average calories, protein, deficit across logs."""
    daily = calculate_daily_summary(logs, height_in, age, sex)
    if not daily:
        return {"average calories": 0, "average protein": 0, "average deficit": 0}

    calories = math.floor(sum(log["calorieIntake"] for log in daily) / len(daily))
    protein = math.floor(sum(log["proteinIntake"] for log in daily) / len(daily))
    deficit = math.floor(sum(log["deficit"] for log in daily) / len(daily))

    return {
        "average calories": calories,
        "average protein": protein,
        "average deficit": deficit
    }