# AeroPulse Airfare Anomaly & Price Drift Report

**Generated At**: `2026-09-26 12:09:27 UTC`  
**Pipeline**: `sync_pipeline.py` (Automated 6-Hour Cron)  
**Threshold**: Absolute Price Drift > **15.0%**  
**Total Flights Scanned**: 8 | **Anomalies Flagged**: 6

---

## 🚨 Detected Price Drift Anomalies

The following flights exhibit pricing deviations exceeding the 15% threshold against the local yield forecasting model (`flight_pricing_model.pkl`):

| Flight No | Corridor | Carrier | Dep Time | T-Minus Days | Actual Price | Predicted Price | Absolute Drift | Drift % | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **BA-178** | `JFK -> LHR` | BA | 08:00 | T-3 | ₹68,400.00 | ₹54,818.45 | +₹13,581.55 | **24.78%** | `MODERATE` |
| **VS-4** | `JFK -> LHR` | VS | 18:30 | T-4 | ₹47,500.00 | ₹56,424.02 | ₹-8,924.02 | **15.82%** | `MODERATE` |
| **6E-501** | `DEL -> BOM` | 6E | 06:15 | T-2 | ₹8,650.00 | ₹6,211.07 | +₹2,438.93 | **39.27%** | `HIGH` |
| **AI-805** | `DEL -> BOM` | AI | 10:30 | T-1 | ₹11,200.00 | ₹6,509.44 | +₹4,690.56 | **72.06%** | `HIGH` |
| **EK-511** | `DEL -> DXB` | EK | 11:15 | T-5 | ₹16,920.00 | ₹5,393.66 | +₹11,526.34 | **213.7%** | `HIGH` |
| **6E-442** | `BLR -> CCU` | 6E | 07:05 | T-2 | ₹9,450.00 | ₹6,372.92 | +₹3,077.08 | **48.28%** | `HIGH` |

---

## 📊 Summary of All Monitored Target Routes

| Flight No | Route | Actual (₹) | Predicted (₹) | Drift % | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| BA-178 | JFK -> LHR | ₹68,400.00 | ₹54,818.45 | 24.78% | ⚠️ ANOMALY (>15%) |
| VS-4 | JFK -> LHR | ₹47,500.00 | ₹56,424.02 | 15.82% | ⚠️ ANOMALY (>15%) |
| AA-100 | JFK -> LHR | ₹62,300.00 | ₹56,762.97 | 9.75% | ✅ NORMAL |
| BA-112 | JFK -> LHR | ₹50,500.00 | ₹52,057.69 | 2.99% | ✅ NORMAL |
| 6E-501 | DEL -> BOM | ₹8,650.00 | ₹6,211.07 | 39.27% | ⚠️ ANOMALY (>15%) |
| AI-805 | DEL -> BOM | ₹11,200.00 | ₹6,509.44 | 72.06% | ⚠️ ANOMALY (>15%) |
| EK-511 | DEL -> DXB | ₹16,920.00 | ₹5,393.66 | 213.7% | ⚠️ ANOMALY (>15%) |
| 6E-442 | BLR -> CCU | ₹9,450.00 | ₹6,372.92 | 48.28% | ⚠️ ANOMALY (>15%) |

---

## 🔬 Root Cause & Market Factors
1. **Near-Departure Yield Surges (T-Minus 1 to 3 Days)**: Near-date inventory exhaustion triggers automated surge multipliers across global distribution systems (GDS).
2. **Peak Departure Windows**: Flights scheduled during 07:00–10:00 and 18:00–21:00 peak business slots exhibit steep fare acceleration.
3. **Capacity Constraints**: Transatlantic sectors (JFK ⇄ LHR) experience seasonal demand fluctuations affecting premium cabin allocation.

*Report automatically dispatched to workspace monitoring channels.*