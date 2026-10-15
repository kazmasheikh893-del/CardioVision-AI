# Troubleshooting

## Backend cannot find the model

Run:

```powershell
python ml\train_model.py
```

## Frontend cannot reach the API

Start the backend on port `8000`:

```powershell
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Then set `VITE_API_BASE_URL=http://127.0.0.1:8000` if you use a different environment.

## Dataset download fails

Download `processed.cleveland.data` from UCI and place it at:

```text
data/raw/processed.cleveland.data
```

Then rerun the training command.

## 3D model does not render

Confirm `public/models/heart.glb` exists. The app uses browser WebGL through Three.js; update GPU drivers or try another browser if WebGL is disabled.

