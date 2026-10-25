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

The app is not deployed yet. Run it locally using the instructions above.

## AI tools

OpenAI Codex was used to assist with implementation and documentation.
