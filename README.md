# kjhwr

Wind forecast accuracy dashboard built with a React frontend and a Python API. It compares Elexon national wind forecasts with actual wind generation to help users review forecast errors.

## Run locally

### Backend

```powershell
cd backend
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`). The frontend uses `http://localhost:8000` by default. Set `VITE_API_URL` if the API runs elsewhere.

## Analysis choices

- Scope: national wind generation, with `fuelType=WIND` for FUELHH actuals.
- Delivery timestamps are interpreted in `Europe/London`; API timestamps are normalised to UTC for matching.
- Forecast selection is the latest `publishTime` at or before a configurable number of hours before each delivery interval. The initial UI value is 12 hours. This is a transparent implementation assumption, not a verified market decision deadline.
- Error is forecast minus actual. Positive bias means over-forecasting; negative bias means under-forecasting.
- MAE and RMSE are in MW. Only intervals with both forecast and actual are used. Missing values are not set to zero.
- No demo records are substituted for live Elexon data. If the API cannot load, the UI shows an error state.

## Structure

```text
backend/
  main.py            Elexon client, forecast selection, metrics, FastAPI routes
  requirements.txt   Python dependencies
frontend/
  index.html         Vite entry page
  package.json       React and Vite scripts/dependencies
  src/main.jsx       Dashboard, charts, filters, and interval table
  src/styles.css     Responsive visual styling
```

## API

- `GET /api/health`
- `GET /api/dashboard?start_date=2026-01-01&end_date=2026-01-31&cutoff_hours=12`

Elexon sources: [FUELHH](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream) and [WINDFOR](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream).

## Current scope

The January 2026 delivery range is the default and can be changed in the dashboard. The forecast cutoff and the mapping from January purchasing decisions to delivery periods are implementation assumptions that should be confirmed before treating the results as a market decision audit. This repository does not include Docker, authentication, storage, or deployment configuration.

## Deployment

### Backend on Railway

1. Create a Railway project from the GitHub repository.
2. Set the service root directory to `/backend` and the Railway config file path to `/backend/railway.json`.
3. Deploy the service, then generate a public domain in the service's Networking settings.

Railway uses `railway.json` to start Uvicorn on Railway's `PORT` and check `/api/health`.

### Frontend on Vercel

1. Import `kushalbt05/kjhwr` from GitHub.
2. Set the project root directory to `frontend`.
3. Add the environment variable `VITE_API_URL` with the Railway public API URL, for example `https://your-service.up.railway.app`.
4. Deploy. Vercel uses `frontend/vercel.json` to install dependencies, build the Vite app, and publish `dist`.

After Vercel assigns a production domain, add that exact origin to the Railway service variable `FRONTEND_ORIGINS` (for example `https://kjhwr.vercel.app`) and redeploy the backend. For multiple allowed origins, separate them with commas. This CORS setting is required for browsers to call the API.

The application is not deployed yet. Railway's Free plan currently starts with a 30-day trial and $5 credits, then provides $1/month; check Railway's current pricing before creating a service. Vercel lists its Hobby plan at $0/month. See [Railway pricing](https://railway.com/pricing) and [Vercel pricing](https://vercel.com/pricing).

## AI tools

OpenAI Codex was used to assist with implementation and documentation.
