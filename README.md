# AeroPulse India ✈️

**Real-Time Airfare Price Index & Door-to-Door Mobility Intelligence Platform**

AeroPulse India is an interactive aviation price index, route intelligence, and door-to-door journey cost analytics platform designed to track real-time domestic and international airfares, monitor model price drift, and simulate Consumer Price Index (CPI) transport weights.

---

## 🌟 Key Features

- **Overview & Live Flight Search**: Search across major Indian domestic and international aviation corridors with real-time fare comparisons.
- **Airfare Price Index View**: Track Laspeyres, Paasche, and Fisher ideal airfare indices alongside historical trends.
- **Interactive Route Explorer**: Geographic Leaflet map displaying live flight corridors, distance metrics, and hub connectivity.
- **True Door-to-Door Journey Cost**: Combines first-mile airport transit, base ticket fare, taxes, and last-mile ground transport into a unified cost metric.
- **Fair Fare Decomposition & Bias Monitor**: Analyzes carrier pricing, fuel surcharge adjustments, and portal sampling bias.
- **CPI Weight & Policy Simulator**: Interactive simulator for evaluating aviation fare impacts on headline CPI inflation.
- **ML Price Drift & Skyscanner Sync Pipelines**: Python pipelines (`flight_prediction_agent.py`, `skyscanner_sync.py`, `sync_pipeline.py`) powered by a trained Random Forest yield model (`flight_pricing_model.pkl`).

---

## 📁 Project Structure

```text
├── index.html                  # Main application UI & modal views
├── app.js                      # Core SPA controller, routing & interactive calculators
├── charts.js                   # Chart.js analytical visualizations
├── map.js                      # Leaflet geographic route & hub map engine
├── data.js                     # Multi-portal aviation dataset & live FX rate sync
├── vercel.json                 # Vercel deployment & routing configuration
├── package.json                # Project metadata & scripts
├── flight_prediction_agent.py  # Autonomous 6-hour flight price drift agent
├── skyscanner_sync.py          # Skyscanner fare extraction & drift report generator
├── sync_pipeline.py            # Automated anomaly detection pipeline
├── flight_pricing_model.pkl    # Trained Random Forest yield forecasting model
└── reports/                    # Generated markdown drift & synchronization reports
```

---

## 🚀 Deploying to Vercel (via GitHub)

1. **Push this repository to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: AeroPulse India platform"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
2. **Import into Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub.
   - Select your **AeroPulse** repository and click **Import**.
   - Leave **Framework Preset** as **Other** and **Root Directory** as `./`.
   - Click **Deploy** — Vercel will automatically use `vercel.json` and deploy your site live in seconds.

---

## 💻 Running Locally

- **Option 1 (Windows Batch)**: Double-click `START_AEROPULSE.bat`
- **Option 2 (Python)**:
  ```bash
  python -m http.server 8080
  ```
  Then open `http://localhost:8080` in your browser.
- **Option 3 (Node.js)**:
  ```bash
  npm start
  ```
