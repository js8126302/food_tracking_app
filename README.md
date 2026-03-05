# Food Tracker

Full-stack app for logging nutrition and activity data, then visualizing analytics.

## Stack
- Backend: FastAPI + PyMongo
- Frontend: React + Vite + Chart.js
- Database: MongoDB Atlas
- Deployment: Render (Docker)

## Local Run

### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

Create `backend/.env`:

```env
MONGO_URI=mongodb+srv://<user>:<encoded_password>@<cluster>.mongodb.net/calorie_tracker?retryWrites=true&w=majority&appName=<AppName>
MONGO_DB=calorie_tracker
MONGO_COLLECTION=daily_logs
```

## Render Deploy

This repo includes:
- `Dockerfile`
- `render.yaml`

On Render:
1. Create a Blueprint service from this repo.
2. Set `MONGO_URI` in environment variables.
3. Deploy.
