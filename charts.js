/**
 * AeroPulse India - Interactive Charts Module
 * Real-Time Airfare Price Index & Flight Search Intelligence
 */

class AeroPulseCharts {
  constructor() {
    this.instances = {};
    // Set default Chart.js styling
    if (window.Chart) {
      Chart.defaults.font.family = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      Chart.defaults.color = '#64748B';
      Chart.defaults.borderColor = '#E2E8F0';
    }
  }

  destroyChart(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  }

  // 1. National Airfare Price Index (TPI vs PII vs Base)
  renderNationalIndexChart(canvasId, timeframe = 'monthly') {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return;

    const dataSeries = AeroPulseData.timeSeries[timeframe] || AeroPulseData.timeSeries.monthly;

    this.instances[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: dataSeries.labels,
        datasets: [
          {
            label: 'Traveller Price Index (TPI - Actual Paid)',
            data: dataSeries.tpi,
            borderColor: '#E65100', // Saffron-Orange
            backgroundColor: 'rgba(230, 81, 0, 0.08)',
            borderWidth: 2.8,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#E65100',
            pointRadius: timeframe === 'daily' ? 2 : 4,
            pointHoverRadius: 6
          },
          {
            label: 'Pure Inflation Index (PII - Quality & Surge Adjusted)',
            data: dataSeries.pii,
            borderColor: '#0D7A5F', // India Green / Teal
            backgroundColor: 'rgba(13, 122, 95, 0.04)',
            borderWidth: 2.5,
            borderDash: [5, 4],
            fill: false,
            tension: 0.3,
            pointBackgroundColor: '#0D7A5F',
            pointRadius: timeframe === 'daily' ? 2 : 4,
            pointHoverRadius: 6
          },
          {
            label: 'Base Benchmark (Jan 2024 = 100.0)',
            data: dataSeries.base,
            borderColor: '#94A3B8',
            borderWidth: 1.5,
            borderDash: [2, 2],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 14,
              boxHeight: 14,
              usePointStyle: true,
              font: { size: 12, weight: 600 },
              color: '#1E293B'
            }
          },
          tooltip: {
            backgroundColor: '#0A192F',
            titleFont: { size: 13, weight: 'bold' },
            bodyFont: { size: 12 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                return ` ${context.dataset.label.split('(')[0]}: ${context.parsed.y.toFixed(1)}`;
              },
              afterBody: function(contexts) {
                if (contexts.length >= 2) {
                  const tpi = contexts[0].parsed.y;
                  const pii = contexts[1].parsed.y;
                  const wedge = (tpi - pii).toFixed(1);
                  return `\nSurge / Volatility Wedge: ${wedge} index pts`;
                }
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              maxRotation: timeframe === 'daily' ? 45 : 0,
              font: { size: 11 }
            }
          },
          y: {
            min: 95,
            max: Math.max(...dataSeries.tpi) + 6,
            grid: { color: '#F1F5F9' },
            ticks: {
              font: { size: 11 },
              callback: val => `${val}`
            },
            title: {
              display: true,
              text: 'Index Value (Base 2024 = 100)',
              font: { size: 11, weight: 'bold' }
            }
          }
        }
      }
    });
  }

  // 2. Booking Window Curve Chart
  renderBookingWindowChart(canvasId) {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return;

    const windows = AeroPulseData.bookingWindows;

    this.instances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['30 Days (T-30)', '15 Days (T-15)', '7 Days (T-7)', '1 Day (T-1)'],
        datasets: [
          {
            type: 'line',
            label: 'Airfare Price Index',
            data: [98.2, 104.5, 118.9, 148.2],
            borderColor: '#DC2626',
            borderWidth: 3,
            fill: false,
            yAxisID: 'y1',
            tension: 0.3,
            pointBackgroundColor: '#DC2626',
            pointRadius: 6
          },
          {
            type: 'bar',
            label: 'Average Fare (₹ INR)',
            data: [3850, 4400, 5950, 9200],
            backgroundColor: [
              'rgba(16, 185, 129, 0.75)',
              'rgba(59, 130, 246, 0.75)',
              'rgba(245, 158, 11, 0.75)',
              'rgba(239, 68, 68, 0.85)'
            ],
            borderRadius: 6,
            yAxisID: 'y'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { size: 11, weight: 600 } }
          },
          tooltip: {
            backgroundColor: '#0F172A',
            callbacks: {
              label: context => {
                if (context.dataset.type === 'line') return ` Price Index: ${context.parsed.y}`;
                return ` Avg Payable Fare: ₹${context.parsed.y.toLocaleString('en-IN')}`;
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            title: { display: true, text: 'Fare Amount (₹ INR)', font: { size: 11 } },
            ticks: { callback: v => `₹${v.toLocaleString('en-IN')}` },
            grid: { color: '#F1F5F9' }
          },
          y1: {
            position: 'right',
            title: { display: true, text: 'Index (Base 100)', font: { size: 11 } },
            grid: { display: false },
            min: 80,
            max: 160
          }
        }
      }
    });
  }

  // 3. Route Explorer 30-day Trend + 14-day Forecast
  renderRouteTrendChart(canvasId, routeObj) {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return;

    const histLabels = Array.from({ length: 12 }, (_, i) => `D-${(11 - i) * 2.5 | 0}`);
    const forecastLabels = Array.from({ length: 14 }, (_, i) => `+D${i + 1}`);
    const combinedLabels = [...histLabels, ...forecastLabels];

    // Align historical and forecast series
    const histData = [...routeObj.trend30d, ...Array(14).fill(null)];
    const forecastData = [...Array(11).fill(null), routeObj.trend30d[routeObj.trend30d.length - 1], ...routeObj.forecast14d];

    this.instances[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: combinedLabels,
        datasets: [
          {
            label: 'Actual Observed Fares (30-Day History)',
            data: histData,
            borderColor: '#1D4ED8',
            backgroundColor: 'rgba(29, 78, 216, 0.08)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.3,
            pointRadius: 3
          },
          {
            label: 'Algorithmic 14-Day Forecast (Expected Yield)',
            data: forecastData,
            borderColor: '#F59E0B',
            borderWidth: 2.5,
            borderDash: [5, 5],
            fill: false,
            tension: 0.3,
            pointRadius: 3
          },
          {
            label: 'Expected Normal Baseline',
            data: Array(combinedLabels.length).fill(routeObj.expectedNormalFare),
            borderColor: '#10B981',
            borderWidth: 1.5,
            borderDash: [3, 3],
            fill: false,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { size: 11, weight: 600 }, usePointStyle: true }
          },
          tooltip: {
            backgroundColor: '#0F172A',
            callbacks: {
              label: ctx => {
                if (ctx.parsed.y === null) return null;
                return ` ${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString('en-IN')}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: '#F8FAFC' },
            ticks: { font: { size: 10 } }
          },
          y: {
            ticks: { callback: v => `₹${v}` },
            grid: { color: '#F1F5F9' },
            title: { display: true, text: 'Ticket Price (INR)', font: { size: 11 } }
          }
        }
      }
    });
  }

  // 4. True Journey Cost Comparison Bar Chart
  renderTrueCostComparisonChart(canvasId) {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return;

    const routes = [
      'DEL → JAI (Short Haul)',
      'BLR → BOM (Metro Trunk)',
      'DEL → BOM (Golden Corridor)',
      'BLR → CCU (East Link)',
      'BOM → GOI (Coastal)',
      'CCU → PYG (UDAN Remote)'
    ];

    const flightFares = [3000, 5200, 8900, 9450, 6800, 4200];
    const groundCosts = [1050, 2300, 1400, 1100, 2050, 2650];

    this.instances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: routes,
        datasets: [
          {
            label: 'Flight Airfare (Airline Quoted)',
            data: flightFares,
            backgroundColor: '#1E3A8A', // Navy Blue
            borderRadius: 4,
            stack: 'Stack 0'
          },
          {
            label: 'Ground Airport Transit (Door-to-Airport + Airport-to-Door)',
            data: groundCosts,
            backgroundColor: '#F59E0B', // Amber
            borderRadius: 4,
            stack: 'Stack 0'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { size: 11, weight: 600 } }
          },
          tooltip: {
            backgroundColor: '#0F172A',
            callbacks: {
              afterBody: function(items) {
                if (items.length >= 2) {
                  const flight = items[0].raw;
                  const ground = items[1].raw;
                  const total = flight + ground;
                  const groundPct = ((ground / total) * 100).toFixed(1);
                  return `\nTotal True Journey Cost: ₹${total.toLocaleString('en-IN')}\nGround Transit Share: ${groundPct}%`;
                }
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 } }
          },
          y: {
            stacked: true,
            ticks: { callback: v => `₹${v.toLocaleString('en-IN')}` },
            grid: { color: '#F1F5F9' },
            title: { display: true, text: 'Total Trip Cost (₹ INR)', font: { size: 11 } }
          }
        }
      }
    });
  }

  // 5. Consumer Profiles 6-Month Inflation Trend
  renderProfilesTrendChart(canvasId) {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return;

    const months = ['Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026'];
    const profiles = AeroPulseData.passengerProfiles;

    const colors = {
      student: '#10B981',
      business: '#3B82F6',
      family: '#F59E0B',
      emergency: '#EF4444'
    };

    const datasets = profiles.map(p => ({
      label: `${p.name} (+${p.sixMonthInflationPct}%)`,
      data: p.trendData,
      borderColor: colors[p.id],
      backgroundColor: 'transparent',
      borderWidth: 2.5,
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 6
    }));

    this.instances[canvasId] = new Chart(canvas, {
      type: 'line',
      data: { labels: months, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { size: 11, weight: 600 }, usePointStyle: true }
          },
          tooltip: {
            backgroundColor: '#0F172A',
            callbacks: {
              label: ctx => ` ${ctx.dataset.label.split('(')[0]}: ₹${ctx.parsed.y.toLocaleString('en-IN')}`
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            ticks: { callback: v => `₹${v.toLocaleString('en-IN')}` },
            grid: { color: '#F1F5F9' },
            title: { display: true, text: 'Effective Persona Cost (₹ INR)', font: { size: 11 } }
          }
        }
      }
    });
  }

  // 6. Loyalty Devaluation Time Series Chart
  renderLoyaltyDevaluationChart(canvasId) {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return;

    const timeData = AeroPulseData.loyaltyDevaluation.devaluationTimeSeries;

    this.instances[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: timeData.labels,
        datasets: [
          {
            label: 'Purchasing Power per Reward Point (₹ INR equivalent)',
            data: timeData.effectiveValuePerPointINR,
            borderColor: '#7C3AED', // Purple
            backgroundColor: 'rgba(124, 58, 237, 0.08)',
            borderWidth: 2.8,
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: '#7C3AED'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 11, weight: 600 } } },
          tooltip: {
            backgroundColor: '#0F172A',
            callbacks: {
              label: ctx => ` 1 Frequent Flyer Point = ₹${ctx.parsed.y.toFixed(2)} INR`,
              afterBody: () => '\nHidden Loyalty Inflation: Points devalued by ~41% over 2.5 years'
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            min: 0.4,
            max: 1.2,
            ticks: { callback: v => `₹${v.toFixed(2)}` },
            grid: { color: '#F1F5F9' },
            title: { display: true, text: 'Real Rupee Value per Point', font: { size: 11 } }
          }
        }
      }
    });
  }

  // 7. CPI Simulator Before vs After Chart
  renderCPISimulatorChart(canvasId, simResults) {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return;

    this.instances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: [
          'Airfare Price Index',
          'Transport Sub-Index (Weight ~8.59%)',
          'True Journey Cost Index',
          'Headline CPI Contribution (bps)'
        ],
        datasets: [
          {
            label: 'Baseline (Current NSO Values)',
            data: [108.4, 114.2, 112.1, 14.2],
            backgroundColor: '#3B82F6',
            borderRadius: 6
          },
          {
            label: 'Simulated Shock Scenario',
            data: [
              simResults.projectedAirfareIndex,
              simResults.projectedTransportSubIndex,
              simResults.projectedTrueJourneyIndex,
              simResults.cpiImpactBps
            ],
            backgroundColor: '#EF4444',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { size: 11, weight: 600 } }
          },
          tooltip: {
            backgroundColor: '#0F172A',
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10.5 } } },
          y: {
            grid: { color: '#F1F5F9' },
            ticks: { font: { size: 11 } },
            title: { display: true, text: 'Index / Basis Points', font: { size: 11 } }
          }
        }
      }
    });
  }
}

// Export instance
window.AeroPulseCharts = new AeroPulseCharts();
