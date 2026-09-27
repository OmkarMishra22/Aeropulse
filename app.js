/**
 * AeroPulse India - Main Application Controller
 * Real-Time Airfare Price Index & Flight Search Intelligence
 * Cleaned Navigation & Flight Search Engine on Real Geographic Leaflet Map
 */

class AeroPulseApp {
  constructor() {
    this.currentView = 'overview';
    this.activeRouteId = 'DEL-BOM';
    this.mapInstance = null;
    this.searchOrigin = 'DEL';
    this.searchDest = 'BOM';
    this.searchDate = '2026-09-28';
  }

  init() {
    // URL Query parameters support for origin, destination, and date
    const urlParams = new URLSearchParams(window.location.search);
    const qOrigin = (urlParams.get('from') || urlParams.get('origin') || '').toUpperCase();
    const qDest = (urlParams.get('to') || urlParams.get('dest') || '').toUpperCase();
    const qDate = urlParams.get('date');
    if (qOrigin && qDest && qOrigin !== qDest) {
      this.searchOrigin = qOrigin;
      this.searchDest = qDest;
      if (qDate) this.searchDate = qDate;
      this.activeRouteId = `${qOrigin}-${qDest}`;
      this.syncTrueCostForRoute(qOrigin, qDest);
    }

    this.renderHeader();
    this.renderSidebar();
    this.setupNavigation();

    // Trigger live rate synchronization using configured API key
    if (window.AeroPulseData && window.AeroPulseData.rateSync) {
      window.AeroPulseData.rateSync.syncRates();
    }

    // Hash routing support
    const validViews = ['overview', 'index-view', 'route-explorer', 'true-cost', 'fair-fare', 'bias-monitor', 'cpi-simulator'];
    const initialHash = window.location.hash.replace('#', '');
    if (validViews.includes(initialHash)) {
      this.showView(initialHash);
    } else {
      this.showView('overview');
    }
    if (initialHash === 'report' || initialHash === 'modal') {
      this.openReportModal();
    }
    if (initialHash === 'keypad' || urlParams.get('keypad')) {
      setTimeout(() => {
        this.openAirportKeypad('origin', this.searchOrigin, (code) => {
          this.setGlobalRoute(code, this.searchDest, this.searchDate);
        });
        const searchInput = document.getElementById('airport-keypad-search-input');
        const qKey = urlParams.get('keypad_query');
        if (qKey && searchInput) {
          searchInput.value = qKey;
          this.renderKeypadList(qKey);
        }
      }, 150);
    }
    window.addEventListener('hashchange', () => {
      const h = window.location.hash.replace('#', '');
      if (h === 'report' || h === 'modal') {
        this.openReportModal();
      } else if (validViews.includes(h) && h !== this.currentView) {
        this.showView(h);
      }
    });

    this.setupReportModal();
    this.setupAirportKeypadModal();
  }

  // Helper to synchronize True Journey Cost calculator to any origin/destination pair
  syncTrueCostForRoute(origin, dest) {
    const apOrigin = AeroPulseData.airports[origin] || { city: origin };
    const apDest = AeroPulseData.airports[dest] || { city: dest };
    const route = AeroPulseData.getRoute ? AeroPulseData.getRoute(origin, dest) : null;
    const flights = this.getMatchingFlights(origin, dest);
    const lowestFare = (flights && flights.length > 0) ? Math.min(...flights.map(f => f.price)) : (route ? route.currentFare : 6000);
    const depModes = AeroPulseData.getTransitOptionsForAirport ? AeroPulseData.getTransitOptionsForAirport(origin) : [];
    const arrModes = AeroPulseData.getTransitOptionsForAirport ? AeroPulseData.getTransitOptionsForAirport(dest) : [];
    const defaultDep = depModes[1] || depModes[0] || { cost: 650, name: 'App Cab', timeMins: 50 };
    const defaultArr = arrModes[1] || arrModes[0] || { cost: 400, name: 'Prepaid Taxi', timeMins: 35 };

    this.calculatorState = {
      preset: 'active-searched',
      originCode: origin,
      destCode: dest,
      depCity: `${apOrigin.city} (${origin})`,
      arrCity: `${apDest.city} (${dest})`,
      depTransitModeCost: defaultDep.cost,
      depTransitModeName: defaultDep.name,
      depTransitTime: defaultDep.timeMins,
      ticketFare: lowestFare,
      flightTime: route ? Math.max(45, Math.round(route.distanceKm / 500 * 60)) : 120,
      arrTransitModeCost: defaultArr.cost,
      arrTransitModeName: defaultArr.name,
      arrTransitTime: defaultArr.timeMins,
      customRouteName: `${apOrigin.city} ⇄ ${apDest.city}`,
      isManualEdit: false
    };
  }

  // Centralized Route Synchronization: Updates every option across the ENTIRE platform in real-time
  setGlobalRoute(origin, dest, date = null, targetView = null) {
    if (!origin || !dest) return;
    if (origin === dest) {
      alert("Origin and Destination cannot be the same airport. Please choose two different cities.");
      return;
    }

    this.searchOrigin = origin;
    this.searchDest = dest;
    if (date) this.searchDate = date;
    this.activeRouteId = `${origin}-${dest}`;

    const apOrigin = AeroPulseData.airports[origin] || { city: origin, name: origin };
    const apDest = AeroPulseData.airports[dest] || { city: dest, name: dest };

    // Ensure route profile exists in AeroPulseData
    const route = AeroPulseData.getRoute ? AeroPulseData.getRoute(origin, dest) : null;

    // 1. Sync True Journey Cost calculator state dynamically to the searched sector
    this.syncTrueCostForRoute(origin, dest);

    // 2. Sync CPI Simulator state
    if (!this.simState) {
      this.simState = {
        nationalAirfarePct: 10,
        routeShockPct: 15,
        festivalScenario: 'Diwali',
        lastMinuteSharePct: 22,
        groundTransitPct: 5
      };
    }
    if (route) {
      this.simState.routeShockPct = Math.round(route.variancePct);
      if (route.variancePct > 15) {
        this.simState.festivalScenario = 'Diwali';
      }
    }

    // 3. Update Header Indicator in DOM immediately
    const badgeEl = document.getElementById('header-active-route-badge');
    if (badgeEl) {
      badgeEl.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
        <span class="text-slate-400 text-[11px] font-semibold">Active Corridor:</span>
        <span class="text-white font-black">${apOrigin.city} (${origin}) ⇄ ${apDest.city} (${dest})</span>
        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">${this.searchDate}</span>
      `;
    }

    // 4. Update Leaflet Map if instance exists
    if (this.mapInstance && typeof this.mapInstance.highlightRoute === 'function') {
      this.mapInstance.highlightRoute(origin, dest);
    }

    // 5. If targetView is specified, navigate to it; otherwise re-render active view
    if (targetView && targetView !== this.currentView) {
      this.showView(targetView);
    } else {
      switch (this.currentView) {
        case 'overview':
          this.renderOverview();
          break;
        case 'route-explorer':
          this.renderRouteExplorer();
          break;
        case 'index-view':
          this.renderIndexView();
          break;
        case 'true-cost':
          this.renderTrueCostView();
          break;
        case 'fair-fare':
          this.renderFairFareView();
          break;
        case 'bias-monitor':
          this.renderBiasMonitorView();
          break;
        case 'cpi-simulator':
          this.renderCPISimulatorView();
          break;
      }
    }
  }

  // Header Bar with MoSPI Emblem, Sync Ticker, and Export Button
  renderHeader() {
    const header = document.getElementById('app-header');
    if (!header) return;

    header.innerHTML = `
      <div class="flex items-center justify-between w-full px-4 lg:px-6 py-2.5 bg-[#0A192F] text-white border-b border-slate-800 shadow-md">
        
        <!-- Left: Logo & Government Portal Branding -->
        <div class="flex items-center gap-3.5">
          <button id="sidebar-toggle-btn" class="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 lg:hidden">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
          
          <div class="flex items-center gap-3">
            <!-- AeroPulse Modern Human-Designed Logo -->
            <div class="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 p-[1.5px] shadow-lg shadow-blue-500/25 cursor-pointer group" onclick="window.aeroApp && window.aeroApp.showView('overview')" title="AeroPulse Home">
              <div class="w-full h-full bg-[#070F21] rounded-[10px] flex items-center justify-center overflow-hidden">
                <svg viewBox="0 0 32 32" class="w-6 h-6 transition-transform group-hover:scale-105" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 17L13 13L16 5L19 13L28 17L19 17L16 27L13 17L4 17Z" fill="url(#apBrandLogoGrad)" />
                  <circle cx="16" cy="15" r="2.5" fill="#38BDF8" />
                  <defs>
                    <linearGradient id="apBrandLogoGrad" x1="4" y1="5" x2="28" y2="27" gradientUnits="userSpaceOnUse">
                      <stop stop-color="#38BDF8" />
                      <stop offset="0.5" stop-color="#60A5FA" />
                      <stop offset="1" stop-color="#818CF8" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
            <div>
              <h1 class="font-bold tracking-tight text-lg text-white hover:text-sky-300 transition cursor-pointer" onclick="window.aeroApp && window.aeroApp.showView('overview')">AeroPulse</h1>
            </div>
          </div>
        </div>

        <!-- Active Corridor Global Ticker Indicator -->
        <div id="header-active-route-badge" class="hidden md:flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-blue-500/40 text-xs shadow-inner cursor-pointer" onclick="window.aeroApp && window.aeroApp.showView('overview')" title="Click to open route in Overview Dashboard">
          <span class="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
          <span class="text-slate-400 text-[11px] font-semibold">Active Corridor:</span>
          <span class="text-white font-black">${AeroPulseData.airports[this.searchOrigin]?.city || this.searchOrigin} (${this.searchOrigin}) ⇄ ${AeroPulseData.airports[this.searchDest]?.city || this.searchDest} (${this.searchDest})</span>
          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">${this.searchDate}</span>
        </div>

        <!-- Right: Rate Sync Badge, Live Scrape Ticker & Action Button -->
        <div class="flex items-center gap-3">
          <!-- Live Rate Sync Badge powered by User API Key -->
          <div id="rate-sync-badge" class="hidden lg:flex items-center gap-2 bg-emerald-950/70 px-3 py-1.5 rounded-lg border border-emerald-500/50 text-xs shadow-inner cursor-pointer hover:border-emerald-400 transition" onclick="window.AeroPulseData && window.AeroPulseData.rateSync && window.AeroPulseData.rateSync.syncRates()" title="Live Rate Sync Active (API Key: 6ab7790dc33357cccf7ad08b). Click to refresh.">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span class="text-emerald-300 font-bold">Rates Synced:</span>
            <span class="font-mono text-emerald-200 text-[10px] bg-slate-900/80 px-1.5 py-0.5 rounded border border-emerald-500/30">API: 6ab7...08b</span>
            <span class="text-slate-300 font-semibold">1 USD = ₹<span id="header-usd-rate">${AeroPulseData.rateSync ? AeroPulseData.rateSync.rates.USD.toFixed(2) : '83.95'}</span></span>
          </div>

          <div class="hidden 2xl:flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700/80 text-xs">
            <span class="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
            <span class="text-slate-300 font-medium">Scraper:</span>
            <span class="text-sky-400 font-bold">48,290</span>
            <span class="text-slate-400 text-[11px]">fares</span>
          </div>

          <button id="open-report-btn" class="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition transform active:scale-95">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            <span>Download CPI Report</span>
          </button>
        </div>

      </div>
    `;

    document.getElementById('open-report-btn')?.addEventListener('click', () => {
      this.openReportModal();
    });

    document.getElementById('sidebar-toggle-btn')?.addEventListener('click', () => {
      const sidebar = document.getElementById('app-sidebar');
      sidebar?.classList.toggle('-translate-x-full');
    });
  }

  // Cleaned 7 Nav Items
  renderSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    if (!sidebar) return;

    const navItems = [
      { id: 'overview', name: '1. Overview Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
      { id: 'index-view', name: '2. Airfare Price Index', icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z' },
      { id: 'route-explorer', name: '3. Route Explorer', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
      { id: 'true-cost', name: '4. True Journey Cost', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', badge: 'Differentiator' },
      { id: 'fair-fare', name: '5. Fair Fare & Explanation', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
      { id: 'bias-monitor', name: '6. Bias & Data Quality', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
      { id: 'cpi-simulator', name: '7. CPI Impact Simulator', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', badge: 'Policy Tool' }
    ];

    let itemsHtml = navItems.map(item => `
      <button class="nav-item w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold text-xs transition text-left group ${this.currentView === item.id ? 'bg-blue-900/60 text-white border border-blue-600/50 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}" data-view="${item.id}">
        <div class="flex items-center gap-2.5">
          <svg class="w-4 h-4 transition ${this.currentView === item.id ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${item.icon}"></path>
          </svg>
          <span>${item.name}</span>
        </div>
        ${item.badge ? `<span class="px-1.5 py-0.5 text-[9px] font-bold rounded ${item.badge === 'Differentiator' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'}">${item.badge}</span>` : ''}
      </button>
    `).join('');

    sidebar.innerHTML = `
      <div class="h-full flex flex-col justify-between p-3.5 bg-[#0A192F] text-white border-r border-slate-800">
        <div>
          <!-- Sidebar Brand Lockup -->
          <div class="px-2 py-3 mb-2 border-b border-slate-800 flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-sky-400 p-[1px] flex items-center justify-center shrink-0 shadow-sm">
              <div class="w-full h-full bg-[#070F21] rounded-[7px] flex items-center justify-center">
                <svg viewBox="0 0 32 32" class="w-4 h-4" fill="none">
                  <path d="M4 17L13 13L16 5L19 13L28 17L19 17L16 27L13 17L4 17Z" fill="#38BDF8" />
                </svg>
              </div>
            </div>
            <div>
              <div class="text-xs font-bold text-white tracking-tight">AeroPulse</div>
              <div class="text-[10px] text-slate-400">Flight & Mobility Platform</div>
            </div>
          </div>

          <!-- Navigation Links -->
          <nav class="space-y-1 my-2">
            ${itemsHtml}
          </nav>
        </div>

        <!-- Sidebar Footer -->
        <div class="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-[11px]">
          <div class="flex items-center justify-between text-slate-400 mb-1">
            <span>Confidence Index</span>
            <span class="text-emerald-400 font-bold">98.4%</span>
          </div>
          <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
            <div class="bg-emerald-500 h-full rounded-full" style="width: 98.4%"></div>
          </div>
          <div class="text-[10px] text-slate-400 leading-tight">
            <strong class="text-slate-200">AeroPulse Enterprise</strong> | Real-Time Airfare Engine
          </div>
        </div>
      </div>
    `;
  }

  setupNavigation() {
    document.addEventListener('click', (e) => {
      const navBtn = e.target.closest('.nav-item');
      if (navBtn) {
        const viewId = navBtn.getAttribute('data-view');
        if (viewId) {
          this.showView(viewId);
          const sidebar = document.getElementById('app-sidebar');
          if (window.innerWidth < 1024 && sidebar) {
            sidebar.classList.add('-translate-x-full');
          }
        }
      }
    });

    document.addEventListener('click', (e) => {
      const bNav = e.target.closest('.mobile-bnav-btn');
      if (bNav) {
        const viewId = bNav.getAttribute('data-view');
        if (viewId) this.showView(viewId);
      }
    });
  }

  showView(viewId) {
    this.currentView = viewId;
    if (window.location.hash !== `#${viewId}`) {
      window.location.hash = viewId;
    }
    this.renderSidebar();

    const containers = document.querySelectorAll('.view-container');
    containers.forEach(c => c.classList.add('hidden'));

    const target = document.getElementById(`view-${viewId}`);
    if (target) {
      target.classList.remove('hidden');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    switch (viewId) {
      case 'overview':
        this.renderOverview();
        break;
      case 'index-view':
        this.renderIndexView();
        break;
      case 'route-explorer':
        this.renderRouteExplorer();
        break;
      case 'true-cost':
        this.renderTrueCostView();
        break;
      case 'fair-fare':
        this.renderFairFareView();
        break;
      case 'bias-monitor':
        this.renderBiasMonitorView();
        break;
      case 'cpi-simulator':
        this.renderCPISimulatorView();
        break;
    }
  }

  // ==========================================
  // 1. OVERVIEW DASHBOARD WITH FLIGHT SEARCH ENGINE & REAL LEAFLET MAP
  // ==========================================
  renderOverview() {
    const root = document.getElementById('view-overview');
    if (!root) return;

    const meta = AeroPulseData.meta;
    const airports = AeroPulseData.airports;

    // Get matching flights for current search selection
    const flights = this.getMatchingFlights(this.searchOrigin, this.searchDest);

    // List of airport options for select dropdowns
    const airportKeys = Object.keys(airports);

    root.innerHTML = `
      <div class="space-y-6">

        <!-- NEW CORE FEATURE: Real-Time Flight Search & Corridor Analyzer Bar -->
        <div class="bg-gradient-to-r from-slate-900 via-[#0A192F] to-blue-950 text-white rounded-2xl p-5 shadow-xl border border-slate-700">
          <div class="flex items-center justify-between mb-3 border-b border-slate-700 pb-2.5">
            <div class="flex items-center gap-2">
              <span class="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-400/30">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </span>
              <h3 class="font-black text-sm text-white uppercase tracking-wider">Search Flights (Domestic & International) & Open Live Dashboard</h3>
            </div>
            <span class="text-[11px] text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">Live Airline Schedule & Pricing Engine</span>
          </div>

          <!-- Search Inputs Form with Interactive Keypad Triggers -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end text-slate-900">
            
            <!-- Source Origin Keypad Trigger (4 cols) -->
            <div class="lg:col-span-4">
              <label class="block text-[11px] font-bold text-slate-300 mb-1">Source (Origin Airport)</label>
              <div id="flight-search-origin-trigger" class="cursor-pointer p-2.5 rounded-xl border border-slate-600 bg-white hover:border-blue-500 hover:shadow-md transition text-slate-900 group">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-lg bg-blue-600 text-white font-mono font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                      ${this.searchOrigin}
                    </span>
                    <div>
                      <div class="font-black text-xs sm:text-sm text-slate-900">${airports[this.searchOrigin]?.city || this.searchOrigin}</div>
                      <div class="text-[10px] text-slate-500 truncate max-w-[150px] sm:max-w-[200px]">${airports[this.searchOrigin]?.name || 'Airport'}</div>
                    </div>
                  </div>
                  <span class="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg flex items-center gap-1 group-hover:bg-blue-600 group-hover:text-white transition">
                    <span>Keypad</span>
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </span>
                </div>
              </div>
            </div>

            <!-- Swap Button (1 col) -->
            <div class="lg:col-span-1 flex justify-center pb-0.5">
              <button id="flight-search-swap-btn" class="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 transition transform active:scale-95 shadow-sm" title="Swap Origin and Destination">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
              </button>
            </div>

            <!-- Destination Keypad Trigger (4 cols) -->
            <div class="lg:col-span-4">
              <label class="block text-[11px] font-bold text-slate-300 mb-1">Destination Airport</label>
              <div id="flight-search-dest-trigger" class="cursor-pointer p-2.5 rounded-xl border border-slate-600 bg-white hover:border-blue-500 hover:shadow-md transition text-slate-900 group">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-lg bg-indigo-600 text-white font-mono font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                      ${this.searchDest}
                    </span>
                    <div>
                      <div class="font-black text-xs sm:text-sm text-slate-900">${airports[this.searchDest]?.city || this.searchDest}</div>
                      <div class="text-[10px] text-slate-500 truncate max-w-[150px] sm:max-w-[200px]">${airports[this.searchDest]?.name || 'Airport'}</div>
                    </div>
                  </div>
                  <span class="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-lg flex items-center gap-1 group-hover:bg-indigo-600 group-hover:text-white transition">
                    <span>Keypad</span>
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </span>
                </div>
              </div>
            </div>

            <!-- Date & Search (3 cols) -->
            <div class="lg:col-span-3">
              <div class="flex items-end gap-2">
                <div class="flex-1">
                  <label class="block text-[11px] font-bold text-slate-300 mb-1">Travel Date</label>
                  <input type="date" id="flight-search-date" value="${this.searchDate}" class="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-600 bg-white text-slate-900 shadow-sm focus:ring-2 focus:ring-blue-500">
                </div>
                <button id="flight-search-submit-btn" class="py-2.5 px-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white font-black text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-1.5 shrink-0 transform active:scale-95">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                  <span>Search</span>
                </button>
              </div>
            </div>

          </div>

          <!-- Active Corridor Summary Banner -->
          <div class="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div class="flex items-center gap-2">
              <span class="text-slate-400">Current Query:</span>
              <strong class="text-white text-sm">${airports[this.searchOrigin]?.city} (${this.searchOrigin}) ⇄ ${airports[this.searchDest]?.city} (${this.searchDest})</strong>
              <span class="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">${this.searchDate}</span>
            </div>
            <div class="text-slate-300 text-[11px]">
              Found <strong class="text-emerald-400 font-bold">${flights.length} Scheduled Flights</strong> for this day
            </div>
          </div>

        </div>

        <!-- Flights of that Day Result Section -->
        <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="font-black text-base text-slate-900">
                Flights of that Day (${this.searchOrigin} → ${this.searchDest})
              </h3>
              <p class="text-xs text-slate-500">Live airline brand pricing with final payable fare breakdown and seat availability</p>
            </div>
            <span class="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
              Date: ${this.searchDate}
            </span>
          </div>

          <!-- Flight Cards List -->
          <div class="space-y-3">
            ${flights.length === 0 ? `
              <div class="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl space-y-3">
                <div class="w-12 h-12 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto shadow-inner">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                </div>
                <h4 class="font-black text-slate-800 text-base">No Scheduled Flights on this Corridor</h4>
                <p class="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                  No active flight schedules found for <strong>${airports[this.searchOrigin]?.city || this.searchOrigin} (${this.searchOrigin}) → ${airports[this.searchDest]?.city || this.searchDest} (${this.searchDest})</strong> on ${this.searchDate}.
                </p>
                <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-semibold">
                  <span>ℹ️ Strict Sampling:</span>
                  <span>Synthetic auto-routed flights have been disabled. Strict verified flight schedules only.</span>
                </div>
                <div class="pt-3 border-t border-slate-200/80">
                  <div class="text-xs text-slate-500 font-bold mb-2">Switch to tracked primary corridors:</div>
                  <div class="flex flex-wrap items-center justify-center gap-2">
                    <button class="px-3 py-1 text-xs font-bold bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-600 rounded-lg text-slate-700 shadow-sm transition" onclick="window.aeroApp.setGlobalRoute('DEL','BOM')">Delhi ⇄ Mumbai</button>
                    <button class="px-3 py-1 text-xs font-bold bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-600 rounded-lg text-slate-700 shadow-sm transition" onclick="window.aeroApp.setGlobalRoute('DEL','DXB')">Delhi ⇄ Dubai (DXB)</button>
                    <button class="px-3 py-1 text-xs font-bold bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-600 rounded-lg text-slate-700 shadow-sm transition" onclick="window.aeroApp.setGlobalRoute('DEL','SIN')">Delhi ⇄ Singapore (SIN)</button>
                    <button class="px-3 py-1 text-xs font-bold bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-600 rounded-lg text-slate-700 shadow-sm transition" onclick="window.aeroApp.setGlobalRoute('BOM','DXB')">Mumbai ⇄ Dubai (DXB)</button>
                    <button class="px-3 py-1 text-xs font-bold bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-600 rounded-lg text-slate-700 shadow-sm transition" onclick="window.aeroApp.setGlobalRoute('BLR','CCU')">Bengaluru ⇄ Kolkata</button>
                    <button class="px-3 py-1 text-xs font-bold bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-600 rounded-lg text-slate-700 shadow-sm transition" onclick="window.aeroApp.setGlobalRoute('DEL','LHR')">Delhi ⇄ London (LHR)</button>
                  </div>
                </div>
              </div>
            ` : flights.map(fl => {
              const brand = AeroPulseData.airlineBrands[fl.airline] || { color: '#001B94', logoSvg: `<div class="font-bold text-slate-800">${fl.airline}</div>` };
              const portalPrices = AeroPulseData.getPortalPricesForFlight ? AeroPulseData.getPortalPricesForFlight(fl) : [];
              const cheapest = portalPrices.find(p => p.isLowest) || { portal: 'EaseMyTrip', netPrice: fl.price, tag: 'Zero Convenience Fee' };
              return `
                <div class="p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition bg-slate-50/50 flex flex-col gap-3">
                  
                  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <!-- Left: Airline Logo & Flight Info -->
                    <div class="flex items-center gap-4 min-w-[200px]">
                      <div class="w-24 h-10 shrink-0 flex items-center justify-center p-1 rounded-lg bg-white shadow-sm border border-slate-100">
                        ${brand.logoSvg}
                      </div>
                      <div>
                        <div class="font-black text-sm text-slate-900">${fl.airline}</div>
                        <div class="text-[11px] font-mono font-bold text-slate-500">${fl.flightNo} • ${fl.aircraft}</div>
                        ${fl.tag ? `<span class="inline-block mt-0.5 px-1.5 py-0.2 text-[10px] font-bold rounded bg-amber-100 text-amber-800 border border-amber-200">${fl.tag}</span>` : ''}
                      </div>
                    </div>

                    <!-- Center: Timings & Route Duration -->
                    <div class="flex items-center gap-4 text-center">
                      <div>
                        <div class="text-base font-black text-slate-900">${fl.depTime}</div>
                        <div class="text-xs font-bold text-slate-500">${fl.origin}</div>
                      </div>

                      <div class="flex flex-col items-center px-2">
                        <span class="text-[10px] text-slate-400 font-semibold">${fl.duration}</span>
                        <div class="w-20 h-0.5 bg-slate-300 relative my-1">
                          <div class="absolute -top-1 right-0 w-2 h-2 border-t-2 border-r-2 border-slate-400 transform rotate-45"></div>
                        </div>
                        <span class="text-[10px] text-emerald-600 font-bold">${fl.nonStop ? 'Non-stop' : '1 Stop'}</span>
                      </div>

                      <div>
                        <div class="text-base font-black text-slate-900">${fl.arrTime}</div>
                        <div class="text-xs font-bold text-slate-500">${fl.dest}</div>
                      </div>
                    </div>

                    <!-- Right: Price & Open Website / Dashboard Actions -->
                    <div class="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 pt-3 md:pt-0 border-slate-200">
                      <div class="text-left md:text-right">
                        <div class="text-xs text-slate-400">Lowest Verified Checkout</div>
                        <div class="text-2xl font-black text-slate-900 tracking-tight">₹${cheapest.netPrice.toLocaleString('en-IN')}</div>
                        <div class="text-[10px] text-emerald-700 font-semibold">on ${cheapest.portal} (₹0 Fee)</div>
                      </div>

                      <div class="flex items-center gap-2 shrink-0">
                        <a href="${cheapest.bookingUrl}" target="_blank" rel="noopener noreferrer" class="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 shrink-0 transform active:scale-95" title="Open ${cheapest.portal} directly">
                          <span>Open in Website</span>
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                        </a>
                        <button class="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 shrink-0 transform active:scale-95 inspect-flight-btn" data-route="${fl.origin}-${fl.dest}">
                          <span>Dashboard</span>
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Live Portal Price Sync Comparison Strip -->
                  <div class="pt-2.5 border-t border-slate-200/80 bg-white/80 -mx-4 -mb-4 px-4 py-2.5 rounded-b-xl">
                    <div class="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                      <div class="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Live Portal Price Comparison</span>
                        <span class="text-[10px] text-slate-400 font-normal hidden sm:inline">(Synced with MakeMyTrip, Goibibo, EaseMyTrip & Airline Direct)</span>
                      </div>
                      <span class="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                        ✓ Best Net Deal: ${cheapest.portal} (₹${cheapest.netPrice.toLocaleString('en-IN')})
                      </span>
                    </div>

                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      ${portalPrices.map(p => `
                        <div class="p-2.5 rounded-xl border transition flex flex-col justify-between ${p.isLowest ? 'border-emerald-400 bg-emerald-50/70 shadow-sm ring-1 ring-emerald-400/30' : 'border-slate-200 bg-white hover:border-slate-300'}">
                          <div>
                            <div class="flex items-center justify-between mb-1">
                              <span class="font-bold text-[11px] text-slate-900">${p.portal}</span>
                              ${p.isLowest ? '<span class="text-[9px] font-black uppercase bg-emerald-600 text-white px-1.5 py-0.5 rounded">Lowest</span>' : ''}
                            </div>
                            <div class="font-black text-sm text-slate-900">₹${p.netPrice.toLocaleString('en-IN')}</div>
                            <div class="text-[10px] text-slate-500 mt-0.5 truncate">${p.tag}</div>
                          </div>
                          <!-- Open in Website directly under each website and fare -->
                          <a href="${p.bookingUrl}" target="_blank" rel="noopener noreferrer" class="mt-2.5 block w-full text-center py-1.5 px-2 rounded-lg font-bold text-[11px] transition shadow-xs flex items-center justify-center gap-1.5 ${p.isLowest ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}" title="Open ${p.portal} booking page">
                            <span>Open in Website</span>
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                          </a>
                        </div>
                      `).join('')}
                    </div>
                  </div>

                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Section: Interactive Geographic Aviation GIS Map (Full-Bleed & Expanded) -->
        <div class="w-full">
          <div id="overview-map-container"></div>
        </div>

      </div>
    `;

    // Initialize Real Leaflet Map
    setTimeout(() => {
      this.mapInstance = new AeroPulseMap('overview-map-container', {
        onSelectRoute: (routeId) => {
          const parts = routeId.split('-');
          if (parts.length === 2) {
            this.setGlobalRoute(parts[0], parts[1], this.searchDate);
          }
        },
        onSelectAirport: (airportCode) => {
          this.setGlobalRoute(airportCode, this.searchDest, this.searchDate);
        }
      });

      // Highlight current selected route on Leaflet Map
      if (this.searchOrigin && this.searchDest && this.searchOrigin !== this.searchDest) {
        this.mapInstance.highlightRoute(this.searchOrigin, this.searchDest);
      }

      // Attach Search Bar Listeners (Keypad Modal Triggers)
      const originTrigger = document.getElementById('flight-search-origin-trigger');
      const destTrigger = document.getElementById('flight-search-dest-trigger');
      const dateInput = document.getElementById('flight-search-date');
      const searchBtn = document.getElementById('flight-search-submit-btn');
      const swapBtn = document.getElementById('flight-search-swap-btn');

      originTrigger?.addEventListener('click', () => {
        this.openAirportKeypad('origin', this.searchOrigin, (code) => {
          this.setGlobalRoute(code, this.searchDest, this.searchDate);
        });
      });

      destTrigger?.addEventListener('click', () => {
        this.openAirportKeypad('dest', this.searchDest, (code) => {
          this.setGlobalRoute(this.searchOrigin, code, this.searchDate);
        });
      });

      swapBtn?.addEventListener('click', () => {
        this.setGlobalRoute(this.searchDest, this.searchOrigin, this.searchDate);
      });

      searchBtn?.addEventListener('click', () => {
        const currentDateVal = dateInput ? dateInput.value : this.searchDate;
        this.setGlobalRoute(this.searchOrigin, this.searchDest, currentDateVal);
        if (this.mapInstance) {
          this.mapInstance.highlightRoute(this.searchOrigin, this.searchDest);
        }
      });

      dateInput?.addEventListener('change', () => {
        this.setGlobalRoute(this.searchOrigin, this.searchDest, dateInput.value);
      });

      // Handle "Open in Dashboard" clicks on flight cards
      const inspectBtns = root.querySelectorAll('.inspect-flight-btn');
      inspectBtns.forEach(b => {
        b.addEventListener('click', (e) => {
          const route = b.getAttribute('data-route');
          const [orig, dst] = route.split('-');
          this.setGlobalRoute(orig, dst, this.searchDate);
          if (this.mapInstance) {
            this.mapInstance.highlightRoute(orig, dst);
          }
          const mapEl = document.getElementById('overview-map-container');
          mapEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });

    }, 50);
  }

  // Retrieve matching flights for searched corridor - Fully synchronized real airline schedules (never shows empty for served network)
  getMatchingFlights(origin, dest) {
    if (!origin || !dest || origin === dest) return [];
    return AeroPulseData.getFlightsForRoute ? AeroPulseData.getFlightsForRoute(origin, dest, this.searchDate) : (AeroPulseData.dailyFlightSchedules || []).filter(f => f.origin === origin && f.dest === dest);
  }

  selectRouteAndExplore(routeId) {
    const parts = routeId.split('-');
    if (parts.length === 2) {
      this.setGlobalRoute(parts[0], parts[1], this.searchDate, 'route-explorer');
    } else {
      this.activeRouteId = routeId;
      this.showView('route-explorer');
    }
  }

  // ==========================================
  // 2. AIRFARE PRICE INDEX
  // ==========================================
  renderIndexView() {
    const root = document.getElementById('view-index-view');
    if (!root) return;

    const windows = AeroPulseData.bookingWindows;
    const allRoutes = AeroPulseData.getRoutesList ? AeroPulseData.getRoutesList() : AeroPulseData.routes;
    const currentRoute = AeroPulseData.getRoute ? AeroPulseData.getRoute(this.searchOrigin, this.searchDest) : allRoutes[0];

    root.innerHTML = `
      <div class="space-y-6">
        
        <div class="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-black text-slate-900 tracking-tight">Airfare Price Index Engine</h2>
            <p class="text-sm text-slate-600 mt-0.5">Dual-indicator aggregation: Comparing checkout price reality against quality-adjusted pure inflation.</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200">Base: Jan 2024 = 100</span>
          </div>
        </div>

        <!-- Active Searched Corridor Header Banner -->
        <div class="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          
          <!-- Left: Aviation Route Icon & Corridor Info -->
          <div class="flex items-center gap-3.5 shrink-0">
            <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
              <svg class="w-5 h-5 transform -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 shadow-xs">
                  <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                  Active Corridor
                </span>
                <span class="text-xs text-slate-500 font-semibold font-mono">${this.searchDate}</span>
              </div>
              <h3 class="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 whitespace-nowrap">
                <span>${AeroPulseData.airports[this.searchOrigin]?.city || this.searchOrigin} (${this.searchOrigin})</span>
                <span class="text-blue-500 font-bold text-base">⇄</span>
                <span>${AeroPulseData.airports[this.searchDest]?.city || this.searchDest} (${this.searchDest})</span>
              </h3>
            </div>
          </div>

          <!-- Center: High-Impact Structured Price Metrics Pills -->
          <div class="flex flex-wrap items-center gap-2.5">
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 shadow-xs whitespace-nowrap">
              <span class="text-xs text-slate-500 font-medium">Current Fare:</span>
              <span class="text-slate-900 font-black text-sm">₹${currentRoute.currentFare.toLocaleString('en-IN')}</span>
            </div>

            <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 shadow-xs whitespace-nowrap">
              <span class="text-xs text-slate-500 font-medium">Expected Normal:</span>
              <span class="text-slate-700 font-bold text-sm">₹${currentRoute.expectedNormalFare.toLocaleString('en-IN')}</span>
            </div>

            <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl ${currentRoute.variancePct > 0 ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'} shadow-xs whitespace-nowrap">
              <span class="text-xs font-semibold">Variance:</span>
              <span class="font-black text-sm">${currentRoute.variancePct > 0 ? '+' : ''}${currentRoute.variancePct}%</span>
              <span class="text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${currentRoute.variancePct > 20 ? 'bg-rose-200 text-rose-900' : (currentRoute.variancePct > 5 ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900')}">
                ${currentRoute.variancePct > 20 ? 'Surge' : (currentRoute.variancePct > 5 ? 'Elevated' : 'Normal')}
              </span>
            </div>
          </div>

          <!-- Right: Direct Booking & Search Navigation Actions -->
          <div class="flex items-center gap-2 shrink-0 border-t xl:border-t-0 pt-3 xl:pt-0 border-slate-100">
            <a href="${AeroPulseData.generateBookingUrl('MakeMyTrip', this.searchOrigin, this.searchDest, this.searchDate)}" target="_blank" rel="noopener noreferrer" class="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 shrink-0 transform active:scale-95" title="Open flight booking website for this corridor">
              <span>Open in Website</span>
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
            </a>
            <button onclick="window.aeroApp.showView('overview')" class="px-3 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition flex items-center gap-1.5 shadow-sm shrink-0 transform active:scale-95">
              <svg class="w-3.5 h-3.5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <span>Search on Dashboard</span>
            </button>
          </div>

        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-gradient-to-br from-amber-50 to-orange-50/50 p-4 rounded-xl border border-amber-200">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-amber-500"></span>
                <h4 class="font-bold text-sm text-amber-950">Traveller Price Index (TPI)</h4>
              </div>
              <span class="text-xs font-bold text-amber-900 px-2 py-0.5 rounded bg-amber-200/60">Current: 108.4 (+6.2%)</span>
            </div>
            <p class="text-xs text-amber-900/80 leading-relaxed">
              Measures the <strong>actual payable price</strong> paid by travellers today at checkout. Captures full dynamic pricing surges, peak festival premiums, and last-minute booking penalties. Reflects the immediate consumer wallet shock.
            </p>
          </div>

          <div class="bg-gradient-to-br from-emerald-50 to-teal-50/50 p-4 rounded-xl border border-emerald-200">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-emerald-600"></span>
                <h4 class="font-bold text-sm text-emerald-950">Pure Inflation Index (PII)</h4>
              </div>
              <span class="text-xs font-bold text-emerald-900 px-2 py-0.5 rounded bg-emerald-200/60">Current: 104.3 (+2.8%)</span>
            </div>
            <p class="text-xs text-emerald-900/80 leading-relaxed">
              Hedonically filtered index designed for <strong>MoSPI CPI Augmentation</strong>. Isolates fundamental structural cost movement (fuel/ATF, fleet capacity, airport landing tariffs) after neutralizing festival rushes, severe weather diversions, and booking window panic.
            </p>
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 class="font-black text-base text-slate-900">National Index Trend Comparison</h3>
              <p class="text-xs text-slate-500">Comparing Traveller Price Index (Actual) vs Pure Inflation Index (Hedonic) over time</p>
            </div>
            <div class="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button class="index-time-btn px-3 py-1.5 rounded-lg transition ${this.indexTimeframe === 'daily' ? 'bg-white text-slate-900 shadow' : 'text-slate-600 hover:text-slate-900'}" data-time="daily">Daily (30d)</button>
              <button class="index-time-btn px-3 py-1.5 rounded-lg transition ${this.indexTimeframe === 'weekly' ? 'bg-white text-slate-900 shadow' : 'text-slate-600 hover:text-slate-900'}" data-time="weekly">Weekly (12w)</button>
              <button class="index-time-btn px-3 py-1.5 rounded-lg transition ${(!this.indexTimeframe || this.indexTimeframe === 'monthly') ? 'bg-white text-slate-900 shadow' : 'text-slate-600 hover:text-slate-900'}" data-time="monthly">Monthly (12m)</button>
            </div>
          </div>

          <div class="h-80 w-full">
            <canvas id="national-index-chart"></canvas>
          </div>
        </div>

        <div>
          <div class="mb-3">
            <h3 class="font-black text-base text-slate-900">Booking Window Index Progression</h3>
            <p class="text-xs text-slate-500">How fare indices surge as the departure date approaches (30 days vs 15 days vs 7 days vs 1 day before flight)</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            ${windows.map(w => `
              <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition flex flex-col justify-between">
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold text-slate-800">${w.window}</span>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${w.badgeColor}">${w.badge}</span>
                  </div>
                  <div class="text-2xl font-black text-slate-900">${w.indexValue}</div>
                  <div class="text-xs font-semibold text-slate-600 mt-0.5">Average: ₹${w.avgFare.toLocaleString('en-IN')}</div>
                  <p class="text-xs text-slate-500 mt-2 leading-relaxed">${w.description}</p>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="mt-4 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="h-64 w-full">
              <canvas id="booking-window-chart"></canvas>
            </div>
          </div>
        </div>

      </div>
    `;

    setTimeout(() => {
      window.AeroPulseCharts.renderNationalIndexChart('national-index-chart', this.indexTimeframe || 'monthly');
      window.AeroPulseCharts.renderBookingWindowChart('booking-window-chart');

      const btns = root.querySelectorAll('.index-time-btn');
      btns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.indexTimeframe = e.target.getAttribute('data-time');
          this.renderIndexView();
        });
      });

      const sel = root.querySelector('#index-corridor-select');
      sel?.addEventListener('change', (e) => {
        const parts = e.target.value.split('-');
        if (parts.length === 2) {
          this.setGlobalRoute(parts[0], parts[1], this.searchDate);
        }
      });
    }, 50);
  }

  // ==========================================
  // 3. ROUTE EXPLORER
  // ==========================================
  renderRouteExplorer() {
    const root = document.getElementById('view-route-explorer');
    if (!root) return;

    const routes = AeroPulseData.getRoutesList ? AeroPulseData.getRoutesList() : AeroPulseData.routes;
    const current = AeroPulseData.getRoute ? AeroPulseData.getRoute(this.searchOrigin, this.searchDest) : routes[0];

    root.innerHTML = `
      <div class="space-y-6">
        
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 class="text-2xl font-black text-slate-900 tracking-tight">Route Explorer</h2>
            <p class="text-sm text-slate-600 mt-0.5">In-depth corridor analytics, load factors, cross-portal pricing, and dynamic forecasting.</p>
          </div>
          
          <div class="flex items-center gap-2.5">
            <div class="px-3.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold flex items-center gap-2 shadow-sm">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Searched Corridor: <strong class="text-blue-950 font-black">${current.originCode} ⇄ ${current.destCode}</strong> (${AeroPulseData.airports[current.originCode]?.city || current.originCode} to ${AeroPulseData.airports[current.destCode]?.city || current.destCode})</span>
            </div>
            <button onclick="window.aeroApp.showView('overview')" class="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition flex items-center gap-1.5 shadow-sm">
              <svg class="w-3.5 h-3.5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              Search on Dashboard
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div class="text-xs text-slate-500 font-semibold">Current Final Fare</div>
            <div class="text-2xl font-black text-slate-900 mt-1">₹${current.currentFare.toLocaleString('en-IN')}</div>
            <div class="flex items-center gap-1.5 mt-1.5">
              <span class="px-2 py-0.5 text-[10px] font-bold rounded ${current.variancePct > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}">
                ${current.variancePct > 0 ? `+${current.variancePct}% above normal` : `${current.variancePct}% below normal`}
              </span>
            </div>
            <div class="text-[11px] text-slate-400 mt-1">Expected Normal: ₹${current.expectedNormalFare}</div>
          </div>

          <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div class="text-xs text-slate-500 font-semibold">Flight Capacity & Load</div>
            <div class="text-2xl font-black text-slate-900 mt-1">${current.loadFactorPct}% Full</div>
            <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
              <div class="h-full ${current.loadFactorPct > 85 ? 'bg-rose-500' : 'bg-emerald-500'}" style="width: ${current.loadFactorPct}%"></div>
            </div>
            <div class="text-[11px] text-slate-500 mt-1.5">${current.dailyFlights} daily non-stop flights</div>
          </div>

          <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div class="text-xs text-slate-500 font-semibold">Competition (HHI Score)</div>
            <div class="text-2xl font-black text-slate-900 mt-1">${current.competitionHHI}</div>
            <div class="text-[11px] text-amber-700 font-semibold mt-1">${current.competitionLabel}</div>
            <div class="text-[10px] text-slate-400 mt-0.5">Herfindahl-Hirschman Index</div>
          </div>

          <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div class="text-xs text-slate-500 font-semibold">Active Tags & Advisories</div>
            <div class="mt-2 space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-500">Festival:</span>
                <span class="font-bold text-amber-800 px-1.5 py-0.5 rounded bg-amber-50 text-[10px] border border-amber-200">${current.festivalTag}</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-500">Weather:</span>
                <span class="font-bold text-blue-800 px-1.5 py-0.5 rounded bg-blue-50 text-[10px] border border-blue-200">${current.weatherTag}</span>
              </div>
            </div>
          </div>

        </div>

        <div class="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-2.5">
            <div class="p-1.5 rounded-lg bg-emerald-200/60 text-emerald-800 font-bold shrink-0">
              💡 Smart Recommendation
            </div>
            <span class="text-emerald-950 font-medium">${current.altSuggestion}</span>
          </div>
          <button class="px-2.5 py-1 bg-emerald-700 text-white font-bold rounded-lg shrink-0 shadow-sm hover:bg-emerald-800 transition" onclick="window.aeroApp.showView('fair-fare')">
            Check Fair Fare
          </button>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div class="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <div>
              <h3 class="font-bold text-sm text-slate-900">Observed 30-Day Trend & 14-Day Forward Algorithmic Forecast</h3>
              <p class="text-xs text-slate-500">Tracking daily fare movement and algorithmic yield trajectory</p>
            </div>
            <div class="text-xs text-slate-500">
              Range: <strong class="text-slate-800">₹${current.historicalMin}</strong> – <strong class="text-slate-800">₹${current.historicalMax}</strong>
            </div>
          </div>
          <div class="h-72 w-full">
            <canvas id="route-trend-chart"></canvas>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h3 class="font-bold text-sm text-slate-900 mb-2.5">Airline Direct Fare Breakdown</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-xs text-left">
                <thead class="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                  <tr>
                    <th class="p-2">Airline</th>
                    <th class="p-2">Base Fare</th>
                    <th class="p-2">Taxes/UDF</th>
                    <th class="p-2">Baggage</th>
                    <th class="p-2 text-right">Final Fare</th>
                    <th class="p-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 font-medium">
                  ${current.airlines.map(a => `
                    <tr class="hover:bg-slate-50">
                      <td class="p-2 font-bold text-slate-900">${a.name}</td>
                      <td class="p-2 text-slate-600">₹${a.baseFare}</td>
                      <td class="p-2 text-slate-600">₹${a.taxes}</td>
                      <td class="p-2 text-slate-500 text-[11px]">${a.baggage}</td>
                      <td class="p-2 text-right font-black text-slate-900">₹${a.fare}</td>
                      <td class="p-2 text-center">
                        <a href="${a.bookingUrl || AeroPulseData.generateBookingUrl(a.name, current.originCode, current.destCode, window.aeroApp.searchDate, a.name)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white font-bold text-[11px] rounded-lg shadow-xs transition" title="Open official airline site">
                          <span>Open in Website</span>
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                        </a>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div class="flex items-center justify-between mb-2.5">
              <div>
                <h3 class="font-bold text-sm text-slate-900">OTA & Travel Portal Comparison</h3>
                <p class="text-[11px] text-slate-500">Live prices synced across major Indian OTAs for this corridor</p>
              </div>
              <span class="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                5 Sources Monitored
              </span>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-xs text-left">
                <thead class="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                  <tr>
                    <th class="p-2">Portal / Source</th>
                    <th class="p-2">Quoted Fare</th>
                    <th class="p-2">Convenience Fee</th>
                    <th class="p-2">Coupon / Promo</th>
                    <th class="p-2 text-right">Final Checkout Fare</th>
                    <th class="p-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 font-medium">
                  ${current.portals.map(p => `
                    <tr class="hover:bg-slate-50 ${p.isLowest ? 'bg-emerald-50/40' : ''}">
                      <td class="p-2 font-bold text-slate-900 flex items-center gap-1.5">
                        <span>${p.name}</span>
                        ${p.isLowest ? '<span class="text-[9px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded">Cheapest OTA</span>' : ''}
                      </td>
                      <td class="p-2 text-slate-600">₹${(p.quotedFare || p.fare).toLocaleString('en-IN')}</td>
                      <td class="p-2 text-slate-600">${p.fee === 0 ? '<span class="text-emerald-600 font-bold">₹0 (Free)</span>' : `+ ₹${p.fee}`}</td>
                      <td class="p-2 text-slate-500 text-[11px]">
                        ${p.coupon ? `<span class="font-mono font-bold text-slate-700">${p.coupon}</span> (-₹${p.discount || 0})` : p.promo}
                      </td>
                      <td class="p-2 text-right font-black ${p.isLowest ? 'text-emerald-700' : 'text-slate-900'}">
                        ₹${(p.fare || (p.quotedFare + p.fee - (p.discount || 0))).toLocaleString('en-IN')}
                      </td>
                      <td class="p-2 text-center">
                        <a href="${p.bookingUrl || AeroPulseData.generateBookingUrl(p.name, current.originCode, current.destCode, window.aeroApp.searchDate)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2.5 py-1 ${p.isLowest ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold text-[11px] rounded-lg shadow-xs transition" title="Open ${p.name} website">
                          <span>Open in Website</span>
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                        </a>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    `;

    setTimeout(() => {
      window.AeroPulseCharts.renderRouteTrendChart('route-trend-chart', current);
    }, 50);
  }

  // ==========================================
  // 4. TRUE JOURNEY COST: DOOR-TO-DOOR INDEX
  // ==========================================
  renderTrueCostView() {
    const root = document.getElementById('view-true-cost');
    if (!root) return;

    const curRoute = AeroPulseData.getRoute ? AeroPulseData.getRoute(this.searchOrigin, this.searchDest) : null;
    const ap1 = AeroPulseData.airports[this.searchOrigin] || { city: this.searchOrigin };
    const ap2 = AeroPulseData.airports[this.searchDest] || { city: this.searchDest };
    const flights = this.getMatchingFlights(this.searchOrigin, this.searchDest);
    const lowestFare = (flights && flights.length > 0) ? Math.min(...flights.map(f => f.price)) : (curRoute ? curRoute.currentFare : 6000);

    const presets = AeroPulseData.getTrueCostPresets ? AeroPulseData.getTrueCostPresets(this.searchOrigin, this.searchDest) : AeroPulseData.trueCostPresets;
    const depModes = AeroPulseData.getTransitOptionsForAirport ? AeroPulseData.getTransitOptionsForAirport(this.searchOrigin) : [];
    const arrModes = AeroPulseData.getTransitOptionsForAirport ? AeroPulseData.getTransitOptionsForAirport(this.searchDest) : [];
    const defaultDep = depModes[1] || depModes[0] || { cost: 650, name: 'App Cab', timeMins: 50 };
    const defaultArr = arrModes[1] || arrModes[0] || { cost: 400, name: 'Prepaid Taxi', timeMins: 35 };

    if (!this.calculatorState || this.calculatorState.originCode !== this.searchOrigin || this.calculatorState.destCode !== this.searchDest) {
      this.calculatorState = {
        preset: 'active-searched',
        originCode: this.searchOrigin,
        destCode: this.searchDest,
        depCity: `${ap1.city} (${this.searchOrigin})`,
        arrCity: `${ap2.city} (${this.searchDest})`,
        depTransitModeCost: defaultDep.cost,
        depTransitModeName: defaultDep.name,
        depTransitTime: defaultDep.timeMins,
        ticketFare: lowestFare,
        flightTime: curRoute ? Math.max(45, Math.round(curRoute.distanceKm / 500 * 60)) : 120,
        arrTransitModeCost: defaultArr.cost,
        arrTransitModeName: defaultArr.name,
        arrTransitTime: defaultArr.timeMins,
        isManualEdit: false
      };
    }

    const calc = this.calculatorState;
    const totalGroundCost = calc.depTransitModeCost + calc.arrTransitModeCost;
    const totalCost = calc.ticketFare + totalGroundCost;
    const groundPct = ((totalGroundCost / totalCost) * 100).toFixed(1);
    const flightPct = ((calc.ticketFare / totalCost) * 100).toFixed(1);
    const totalTimeMins = calc.depTransitTime + 90 + calc.flightTime + calc.arrTransitTime;
    const totalHours = (totalTimeMins / 60).toFixed(1);

    root.innerHTML = `
      <div class="space-y-6">
        
        <div class="border-b border-slate-200 pb-4">
          <div class="flex items-center gap-2">
            <h2 class="text-2xl font-black text-slate-900 tracking-tight">True Journey Cost (Door-to-Door Index)</h2>
            <span class="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-300">Core Differentiator</span>
          </div>
          <p class="text-sm text-slate-600 mt-1">
            A flight ticket does not represent the real economic cost of air travel. We capture the complete end-to-end expenditure:
          </p>
        </div>

        <div class="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-white rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
          <div class="space-y-1 text-center md:text-left">
            <div class="text-[11px] font-extrabold uppercase tracking-wider text-amber-200">The AeroPulse Mobility Formula</div>
            <div class="text-xl sm:text-2xl font-black tracking-tight">
              True Journey Cost = Final Airfare + Departure Transit + Arrival Transit
            </div>
            <div class="text-xs text-amber-100">Plus 90-minute mandatory airport processing buffer and luggage clearance time</div>
          </div>
          <div class="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/20 text-center shrink-0">
            <div class="text-[10px] text-amber-200 uppercase font-bold">National Ground Friction Wedge</div>
            <div class="text-2xl font-black text-white">+8.7%</div>
            <div class="text-[10px] text-amber-100">MoM rise in airport transit costs</div>
          </div>
        </div>

        <!-- Integrated Corridor Search Bar for True Journey Cost Calculator -->
        <div class="bg-gradient-to-r from-slate-900 via-[#0A192F] to-blue-950 text-white rounded-2xl p-4 shadow-md border border-slate-700">
          <div class="flex items-center justify-between mb-3 border-b border-slate-700/80 pb-2">
            <div class="flex items-center gap-2">
              <span class="p-1 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </span>
              <h4 class="font-black text-xs sm:text-sm text-white uppercase tracking-wider">Search Any Sector to Calculate Door-to-Door Friction</h4>
            </div>
            <span class="text-[10px] text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">Airport Keypad Connected</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-11 gap-3 items-center">
            
            <!-- Calc Origin Trigger (5 cols) -->
            <div class="lg:col-span-5">
              <label class="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">Departure Origin (Ground Transit Start)</label>
              <div id="calc-search-origin-trigger" class="cursor-pointer p-2 rounded-xl border border-slate-600 bg-white hover:border-amber-400 hover:shadow-md transition text-slate-900 group">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="w-7 h-7 rounded-lg bg-blue-600 text-white font-mono font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                      ${this.searchOrigin}
                    </span>
                    <div>
                      <div class="font-black text-xs text-slate-900">${ap1.city} (${this.searchOrigin})</div>
                      <div class="text-[10px] text-slate-500 truncate max-w-[140px] sm:max-w-[180px]">${ap1.name}</div>
                    </div>
                  </div>
                  <span class="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg flex items-center gap-1 group-hover:bg-blue-600 group-hover:text-white transition">
                    <span>Keypad</span>
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </span>
                </div>
              </div>
            </div>

            <!-- Calc Swap (1 col) -->
            <div class="lg:col-span-1 flex justify-center pt-1 sm:pt-4">
              <button id="calc-search-swap-btn" class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 transition transform active:scale-95 shadow-sm" title="Swap Origin and Destination">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
              </button>
            </div>

            <!-- Calc Dest Trigger (5 cols) -->
            <div class="lg:col-span-5">
              <label class="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">Arrival Destination (Final Doorstep End)</label>
              <div id="calc-search-dest-trigger" class="cursor-pointer p-2 rounded-xl border border-slate-600 bg-white hover:border-amber-400 hover:shadow-md transition text-slate-900 group">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="w-7 h-7 rounded-lg bg-indigo-600 text-white font-mono font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                      ${this.searchDest}
                    </span>
                    <div>
                      <div class="font-black text-xs text-slate-900">${ap2.city} (${this.searchDest})</div>
                      <div class="text-[10px] text-slate-500 truncate max-w-[140px] sm:max-w-[180px]">${ap2.name}</div>
                    </div>
                  </div>
                  <span class="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg flex items-center gap-1 group-hover:bg-indigo-600 group-hover:text-white transition">
                    <span>Keypad</span>
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>


        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          <div class="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div class="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 class="font-bold text-base text-slate-900">Interactive Journey Configuration</h3>
              <span class="text-xs text-slate-500">Customized for <strong class="text-slate-800">${ap1.city} → ${ap2.city}</strong></span>
            </div>
            
            <!-- 1. Departure City Center -> Airport -->
            <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-bold text-xs text-slate-800">1. Departure: ${ap1.city} Center → ${this.searchOrigin} Airport</span>
                <span class="text-xs font-bold text-blue-700">₹${calc.depTransitModeCost} (${calc.depTransitModeName})</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                ${depModes.map(m => `
                  <button class="dep-mode-btn p-2 rounded-lg border font-semibold text-center transition ${calc.depTransitModeCost === m.cost ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}" data-cost="${m.cost}" data-name="${m.name}" data-time="${m.timeMins}">
                    <div class="font-bold truncate">${m.name}</div>
                    <div class="text-[10px] ${calc.depTransitModeCost === m.cost ? 'text-blue-100' : 'text-slate-500'}">₹${m.cost} • ${m.timeMins} mins</div>
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- 2. Final Flight Airfare Slider -->
            <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-bold text-xs text-slate-800">2. Final Flight Airfare (${this.searchOrigin} → ${this.searchDest})</span>
                <span class="text-xs font-bold text-blue-700">₹${calc.ticketFare.toLocaleString('en-IN')}</span>
              </div>
              <input type="range" min="${Math.max(1000, Math.round(lowestFare * 0.4))}" max="${Math.max(12000, Math.round(lowestFare * 2.2))}" step="100" value="${calc.ticketFare}" id="calc-ticket-slider" class="w-full accent-blue-600">
              <div class="flex justify-between text-[10px] text-slate-400">
                <span>Saver (₹${Math.max(1000, Math.round(lowestFare * 0.4)).toLocaleString('en-IN')})</span>
                <span class="text-blue-600 font-bold">Observed Ticket: ₹${lowestFare.toLocaleString('en-IN')}</span>
                <span>Peak (₹${Math.max(12000, Math.round(lowestFare * 2.2)).toLocaleString('en-IN')})</span>
              </div>
            </div>

            <!-- 3. Arrival Airport -> Destination City Center -->
            <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-bold text-xs text-slate-800">3. Arrival: ${this.searchDest} Airport → ${ap2.city} Center</span>
                <span class="text-xs font-bold text-blue-700">₹${calc.arrTransitModeCost} (${calc.arrTransitModeName})</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                ${arrModes.map(m => `
                  <button class="arr-mode-btn p-2 rounded-lg border font-semibold text-center transition ${calc.arrTransitModeCost === m.cost ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}" data-cost="${m.cost}" data-name="${m.name}" data-time="${m.timeMins}">
                    <div class="font-bold truncate">${m.name}</div>
                    <div class="text-[10px] ${calc.arrTransitModeCost === m.cost ? 'text-blue-100' : 'text-slate-500'}">₹${m.cost} • ${m.timeMins} mins</div>
                  </button>
                `).join('')}
              </div>
            </div>

          </div>

          <div class="lg:col-span-5 bg-gradient-to-b from-slate-900 to-[#0A192F] text-white rounded-2xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                <span class="text-xs uppercase font-bold text-amber-400">Total True Journey Spend</span>
                <span class="text-[10px] text-slate-400 font-semibold">${this.searchOrigin} ⇄ ${this.searchDest} Door-to-Door</span>
              </div>

              <div class="text-4xl font-black text-white tracking-tight">
                ₹${totalCost.toLocaleString('en-IN')}
              </div>
              <div class="text-xs text-slate-400 mt-1">
                Versus ticket price of ₹${calc.ticketFare.toLocaleString('en-IN')} (Ground adds ₹${totalGroundCost.toLocaleString('en-IN')})
              </div>

              <div class="my-4 space-y-1">
                <div class="flex justify-between text-xs font-semibold">
                  <span class="text-blue-300">Flight: ${flightPct}%</span>
                  <span class="text-amber-400">Ground: ${groundPct}%</span>
                </div>
                <div class="w-full bg-slate-800 h-3 rounded-full overflow-hidden flex">
                  <div class="bg-blue-500 h-full transition-all duration-300" style="width: ${flightPct}%"></div>
                  <div class="bg-amber-400 h-full transition-all duration-300" style="width: ${groundPct}%"></div>
                </div>
              </div>

              <div class="space-y-2 text-xs divide-y divide-slate-800">
                <div class="flex justify-between pt-1 text-slate-300">
                  <span>${ap1.city} Departure Transit:</span>
                  <span class="font-bold text-white">₹${calc.depTransitModeCost}</span>
                </div>
                <div class="flex justify-between pt-1 text-slate-300">
                  <span>Airline Flight Ticket:</span>
                  <span class="font-bold text-white">₹${calc.ticketFare.toLocaleString('en-IN')}</span>
                </div>
                <div class="flex justify-between pt-1 text-slate-300">
                  <span>${ap2.city} Arrival Transit:</span>
                  <span class="font-bold text-white">₹${calc.arrTransitModeCost}</span>
                </div>
                <div class="flex justify-between pt-1 text-slate-300">
                  <span>Total Elapsed Travel Time:</span>
                  <span class="font-bold text-emerald-400">${totalHours} Hours (${totalTimeMins} mins)</span>
                </div>
              </div>

              <!-- Open in Website Direct Booking Action -->
              <a href="${AeroPulseData.generateBookingUrl('MakeMyTrip', this.searchOrigin, this.searchDest, this.searchDate)}" target="_blank" rel="noopener noreferrer" class="mt-4 w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 transform active:scale-95" title="Open flight booking website for this corridor">
                <span>Open in Website (Book Flight Ticket)</span>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
              </a>

            </div>

            <div class="mt-4 p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 text-[11px] text-slate-300">
              <strong class="text-amber-300">MoSPI Policy Takeaway for ${ap1.city} ⇄ ${ap2.city}:</strong> 
              On this corridor, ground transit represents <strong>${groundPct}%</strong> of total traveler expenditure (₹${totalGroundCost.toLocaleString('en-IN')}). 
              Traditional CPI surveys monitoring airline tickets alone understate consumer transportation inflation by omitting terminal transit friction.
            </div>

          </div>

        </div>

        <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div class="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <div>
              <h3 class="font-bold text-sm text-slate-900">Advertised Airline Fare vs True Journey Cost across Corridors</h3>
              <p class="text-xs text-slate-500">Notice how ground connectivity in remote and UDAN airports adds a heavy cost layer</p>
            </div>
          </div>
          <div class="h-72 w-full">
            <canvas id="true-cost-comparison-chart"></canvas>
          </div>
        </div>

      </div>
    `;

    setTimeout(() => {
      window.AeroPulseCharts.renderTrueCostComparisonChart('true-cost-comparison-chart');


      const depBtns = root.querySelectorAll('.dep-mode-btn');
      depBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.calculatorState.isManualEdit = true;
          this.calculatorState.depTransitModeCost = parseInt(btn.getAttribute('data-cost'));
          this.calculatorState.depTransitModeName = btn.getAttribute('data-name');
          this.calculatorState.depTransitTime = parseInt(btn.getAttribute('data-time'));
          this.renderTrueCostView();
        });
      });

      const arrBtns = root.querySelectorAll('.arr-mode-btn');
      arrBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.calculatorState.isManualEdit = true;
          this.calculatorState.arrTransitModeCost = parseInt(btn.getAttribute('data-cost'));
          this.calculatorState.arrTransitModeName = btn.getAttribute('data-name');
          this.calculatorState.arrTransitTime = parseInt(btn.getAttribute('data-time'));
          this.renderTrueCostView();
        });
      });

      const slider = document.getElementById('calc-ticket-slider');
      slider?.addEventListener('input', (e) => {
        this.calculatorState.isManualEdit = true;
        this.calculatorState.ticketFare = parseInt(e.target.value);
        this.renderTrueCostView();
      });

      // Integrated Corridor Keypad Triggers for Calculator
      document.getElementById('calc-search-origin-trigger')?.addEventListener('click', () => {
        this.openAirportKeypad('origin', this.searchOrigin, (code) => {
          this.setGlobalRoute(code, this.searchDest, this.searchDate, 'true-cost');
        });
      });

      document.getElementById('calc-search-dest-trigger')?.addEventListener('click', () => {
        this.openAirportKeypad('dest', this.searchDest, (code) => {
          this.setGlobalRoute(this.searchOrigin, code, this.searchDate, 'true-cost');
        });
      });

      document.getElementById('calc-search-swap-btn')?.addEventListener('click', () => {
        this.setGlobalRoute(this.searchDest, this.searchOrigin, this.searchDate, 'true-cost');
      });

    }, 50);
  }

  // ==========================================
  // 5. FAIR FARE METER & EXPLANATION
  // ==========================================
  renderFairFareView() {
    const root = document.getElementById('view-fair-fare');
    if (!root) return;

    const routes = AeroPulseData.getRoutesList ? AeroPulseData.getRoutesList() : AeroPulseData.routes;
    const current = AeroPulseData.getRoute ? AeroPulseData.getRoute(this.searchOrigin, this.searchDest) : routes[0];

    const clampedVar = Math.max(-50, Math.min(100, current.variancePct));
    const needleDeg = (clampedVar / 100) * 90;

    root.innerHTML = `
      <div class="space-y-6">
        
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 class="text-2xl font-black text-slate-900 tracking-tight">Fair Fare Meter & Algorithmic Explainability</h2>
            <p class="text-sm text-slate-600 mt-0.5">Automated hedonic evaluation detecting abnormal dynamic surges and quantifying root causes.</p>
          </div>
          <div class="flex items-center gap-2.5">
            <div class="px-3.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold flex items-center gap-2 shadow-sm">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Searched Corridor: <strong class="text-blue-950 font-black">${current.originCode} ⇄ ${current.destCode}</strong> (${AeroPulseData.airports[current.originCode]?.city || current.originCode} to ${AeroPulseData.airports[current.destCode]?.city || current.destCode})</span>
            </div>
            <button onclick="window.aeroApp.showView('overview')" class="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition flex items-center gap-1.5 shadow-sm">
              <svg class="w-3.5 h-3.5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <span>Search on Dashboard</span>
            </button>
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            <div class="lg:col-span-6 flex flex-col items-center justify-center p-4">
              <div class="relative w-72 h-40 flex items-end justify-center overflow-hidden">
                <svg viewBox="0 0 200 110" class="w-full h-full">
                  <path d="M 20 100 A 80 80 0 0 1 85 22" fill="none" stroke="#10B981" stroke-width="18" stroke-linecap="round" />
                  <path d="M 85 22 A 80 80 0 0 1 125 22" fill="none" stroke="#F59E0B" stroke-width="18" />
                  <path d="M 125 22 A 80 80 0 0 1 180 100" fill="none" stroke="#EF4444" stroke-width="18" stroke-linecap="round" />
                  <circle cx="100" cy="100" r="10" fill="#0A192F" />
                </svg>

                <div class="absolute bottom-0 left-1/2 w-1.5 h-28 bg-[#0A192F] rounded-full origin-bottom transition-transform duration-700 ease-out shadow-lg" style="transform: translateX(-50%) rotate(${needleDeg}deg);"></div>
              </div>

              <div class="flex justify-between w-64 text-[11px] font-bold mt-2">
                <span class="text-emerald-700">Fair / Normal</span>
                <span class="text-amber-700">Elevated</span>
                <span class="text-rose-700">Surge / Anomaly</span>
              </div>

              <div class="mt-4 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${current.fairnessState === 'Red' ? 'bg-rose-100 text-rose-800 border border-rose-300' : (current.fairnessState === 'Green' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300')}">
                ${current.fairnessLabel}
              </div>
            </div>

            <div class="lg:col-span-6 space-y-4 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-6">
              <div>
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Evaluation Corridors</span>
                <h3 class="text-xl font-black text-slate-900">${current.name}</h3>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div class="text-[11px] text-slate-500 font-semibold">Current Quoted Fare</div>
                  <div class="text-xl font-black text-slate-900 mt-0.5">₹${current.currentFare.toLocaleString('en-IN')}</div>
                  <div class="text-[10px] text-slate-400">Observed checkout price</div>
                </div>
                <div class="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div class="text-[11px] text-slate-500 font-semibold">Expected Normal Fare</div>
                  <div class="text-xl font-black text-slate-600 mt-0.5">₹${current.expectedNormalFare.toLocaleString('en-IN')}</div>
                  <div class="text-[10px] text-slate-400">Hedonic distance/ATF model</div>
                </div>
              </div>

              <div class="p-3 rounded-xl ${current.variancePct > 0 ? 'bg-rose-50 border border-rose-200 text-rose-900' : 'bg-emerald-50 border border-emerald-200 text-emerald-900'} text-xs leading-relaxed">
                <strong>Diagnosis:</strong> ${current.name} is currently priced at <strong>₹${current.currentFare.toLocaleString('en-IN')}</strong>. The expected normal fare is <strong>₹${current.expectedNormalFare.toLocaleString('en-IN')}</strong>. This is <strong>${Math.abs(current.variancePct)}% ${current.variancePct > 0 ? 'above' : 'below'} normal</strong>.
              </div>

              <div class="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>Statistical Confidence: <strong class="text-emerald-700">${current.confidencePct}%</strong></span>
                <span>Sample Depth: <strong class="text-slate-700">420 observations</strong></span>
              </div>

            </div>

          </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="font-black text-base text-slate-900">Why Did This Fare Rise? (Explainability Decomposition)</h3>
              <p class="text-xs text-slate-500">Decomposing fare drivers using MoSPI econometric hedonic regression</p>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Hedonic Decomposition</span>
          </div>

          <div class="space-y-3">
            ${current.explanations.map(exp => `
              <div class="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div class="space-y-0.5">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-xs text-slate-900">${exp.factor}</span>
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${exp.impact.includes('+') ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}">${exp.impact}</span>
                  </div>
                  <div class="text-xs text-slate-600">${exp.detail}</div>
                </div>
                <div class="flex items-center gap-3 shrink-0 self-end md:self-auto">
                  <div class="text-right">
                    <div class="text-xs font-bold text-slate-800">${exp.weightPct}% contribution</div>
                    <div class="text-[10px] text-slate-400">Hedonic Weight</div>
                  </div>
                  <div class="w-16 bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div class="bg-blue-600 h-full rounded-full" style="width: ${exp.weightPct}%"></div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
            <svg class="w-4 h-4 text-blue-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <div>
              <strong>Government Analytics Note:</strong> Factors identified above represent <em>likely contributing factors</em> derived from multi-variable regressions against seat inventory and seasonal baselines. They do not constitute a legal determination of anti-competitive behavior.
            </div>
          </div>

        </div>

      </div>
    `;

    setTimeout(() => {
      const sel = document.getElementById('fair-fare-route-select');
      sel?.addEventListener('change', (e) => {
        const parts = e.target.value.split('-');
        if (parts.length === 2) {
          this.setGlobalRoute(parts[0], parts[1], this.searchDate);
        }
      });
    }, 50);
  }

  // ==========================================
  // 6. BIAS AND DATA QUALITY MONITOR
  // ==========================================
  renderBiasMonitorView() {
    const root = document.getElementById('view-bias-monitor');
    if (!root) return;

    const checks = AeroPulseData.consistencyChecks;
    const dq = AeroPulseData.dataQuality;

    root.innerHTML = `
      <div class="space-y-6">
        
        <div class="border-b border-slate-200 pb-4">
          <h2 class="text-2xl font-black text-slate-900 tracking-tight">Bias and Data Quality Monitor</h2>
          <p class="text-sm text-slate-600 mt-0.5">
            Responsible, evidence-based price consistency auditing and scraper pipeline health telemetry.
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div class="text-xs text-slate-500 font-semibold">Data Pipeline Health</div>
            <div class="text-2xl font-black text-emerald-600 mt-1">${dq.overallHealth}%</div>
            <div class="text-[11px] text-slate-500 mt-0.5">${dq.grade}</div>
          </div>
          <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div class="text-xs text-slate-500 font-semibold">Active Connectors</div>
            <div class="text-2xl font-black text-slate-900 mt-1">${dq.activeConnectors} / ${dq.totalConnectors}</div>
            <div class="text-[11px] text-emerald-600 mt-0.5 font-bold">100% operational feeds</div>
          </div>
          <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div class="text-xs text-slate-500 font-semibold">Outliers Scrubbed (24h)</div>
            <div class="text-2xl font-black text-amber-600 mt-1">${dq.outliersScrubbed24h}</div>
            <div class="text-[11px] text-slate-500 mt-0.5">Tukey IQR boundaries (1.84%)</div>
          </div>
          <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div class="text-xs text-slate-500 font-semibold">Hedonic Model Fit (R²)</div>
            <div class="text-2xl font-black text-blue-600 mt-1">${dq.hedonicModelR2}</div>
            <div class="text-[11px] text-slate-500 mt-0.5">High explanatory power</div>
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-black text-base text-slate-900">Controlled Price Consistency Checks</h3>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">Simultaneous Headless Queries</span>
            </div>
            <p class="text-xs text-slate-500 mt-1">
              We test whether identical flights are quoted at different prices under controlled experimental conditions (Device, Login state, Search frequency, Geolocation).
            </p>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-xs text-left">
              <thead class="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                <tr>
                  <th class="p-3">Test Dimension</th>
                  <th class="p-3">Simulated Target Corridor</th>
                  <th class="p-3">Variant A</th>
                  <th class="p-3">Variant B</th>
                  <th class="p-3">Price Delta</th>
                  <th class="p-3">Status Verdict</th>
                  <th class="p-3">Notes</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 font-medium">
                ${checks.map(c => `
                  <tr class="hover:bg-slate-50">
                    <td class="p-3 font-bold text-slate-900">${c.category}</td>
                    <td class="p-3 text-slate-700">${c.queryRoute}</td>
                    <td class="p-3 text-slate-600">
                      <div>${c.variantA.label}</div>
                      <div class="font-bold text-slate-800">₹${c.variantA.fare}</div>
                    </td>
                    <td class="p-3 text-slate-600">
                      <div>${c.variantB.label}</div>
                      <div class="font-bold text-slate-800">₹${c.variantB.fare}</div>
                    </td>
                    <td class="p-3 font-black ${c.priceDelta === 0 ? 'text-emerald-600' : 'text-amber-600'}">
                      ${c.priceDelta === 0 ? '₹0 (Exact)' : `+₹${c.priceDelta}`}
                    </td>
                    <td class="p-3">
                      <span class="px-2 py-1 rounded text-[10px] font-extrabold border ${c.statusClass}">
                        ${c.status}
                      </span>
                    </td>
                    <td class="p-3 text-[11px] text-slate-500 max-w-xs">${c.notes}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950 flex items-start gap-2">
            <svg class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            <div>
              <strong>Objective Standard:</strong> We do not make accusations of discriminatory profiling. Price differentials are audited for portal pre-ticked add-ons, cookie cache latency, and carrier inventory bucket shifts before affecting national CPI computations.
            </div>
          </div>

        </div>

      </div>
    `;
  }

  // ==========================================
  // 7. CPI IMPACT SIMULATOR
  // ==========================================
  renderCPISimulatorView() {
    const root = document.getElementById('view-cpi-simulator');
    if (!root) return;

    if (!this.simState) {
      this.simState = {
        nationalAirfarePct: 10,
        routeShockPct: 15,
        festivalScenario: 'Diwali',
        lastMinuteSharePct: 22,
        groundTransitPct: 5
      };
    }

    const s = this.simState;

    const projectedAirfareIndex = 108.4 * (1 + s.nationalAirfarePct / 100);
    const effectiveMobilityShock = (s.nationalAirfarePct * 0.65) + (s.groundTransitPct * 0.35) + (s.festivalScenario === 'Diwali' ? 2.5 : 0);
    const projectedTrueJourneyIndex = 112.1 * (1 + effectiveMobilityShock / 100);
    const projectedTransportSubIndex = 114.2 + (s.nationalAirfarePct * 0.12) + (s.groundTransitPct * 0.28);
    const cpiImpactBps = ((s.nationalAirfarePct * 0.042) + (s.groundTransitPct * 0.18)) * 10;

    const simResults = {
      projectedAirfareIndex,
      projectedTrueJourneyIndex,
      projectedTransportSubIndex,
      cpiImpactBps
    };

    root.innerHTML = `
      <div class="space-y-6">
        
        <div class="border-b border-slate-200 pb-4">
          <div class="flex items-center gap-2">
            <h2 class="text-2xl font-black text-slate-900 tracking-tight">CPI Impact Simulator</h2>
            <span class="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-900 border border-blue-300">Macro Policy Sandbox</span>
          </div>
          <p class="text-sm text-slate-600 mt-1">
            Simulate airline pricing shocks, festival rushes, and ground transit tariff increases to forecast real-time macro CPI impact.
          </p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          <div class="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div class="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 class="font-bold text-base text-slate-900">Policy Scenario Controls</h3>
              <span class="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                Corridor: ${AeroPulseData.airports[this.searchOrigin]?.city || this.searchOrigin} ⇄ ${AeroPulseData.airports[this.searchDest]?.city || this.searchDest}
              </span>
            </div>

            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-slate-800">1. National Airfare Increase Percentage</span>
                <span class="font-black text-blue-700 text-sm">${s.nationalAirfarePct > 0 ? `+${s.nationalAirfarePct}%` : `${s.nationalAirfarePct}%`}</span>
              </div>
              <input type="range" min="-20" max="50" step="1" value="${s.nationalAirfarePct}" id="sim-airfare-slider" class="w-full accent-blue-600">
              <div class="flex justify-between text-[10px] text-slate-400">
                <span>Deflation (-20%)</span>
                <span>Current Baseline (0%)</span>
                <span>Hyper-surge (+50%)</span>
              </div>
            </div>

            <div class="space-y-1.5 pt-2">
              <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-slate-800">2. Airport Ground Transit / Fuel Cost Increase</span>
                <span class="font-black text-amber-700 text-sm">+${s.groundTransitPct}%</span>
              </div>
              <input type="range" min="0" max="30" step="1" value="${s.groundTransitPct}" id="sim-transit-slider" class="w-full accent-amber-600">
              <div class="flex justify-between text-[10px] text-slate-400">
                <span>0% (Stable)</span>
                <span>+15% (CNG/Taxi hike)</span>
                <span>+30% (Surge)</span>
              </div>
            </div>

            <div class="space-y-1.5 pt-2">
              <label class="font-bold text-xs text-slate-800 block">3. Festival & Seasonal Demand Multiplier</label>
              <select id="sim-festival-select" class="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-800">
                <option value="None" ${s.festivalScenario === 'None' ? 'selected' : ''}>Off-Peak / Normal Season (0% Multiplier)</option>
                <option value="Diwali" ${s.festivalScenario === 'Diwali' ? 'selected' : ''}>Diwali & Chhath Puja Shock (+18% Trunk Surge)</option>
                <option value="Summer" ${s.festivalScenario === 'Summer' ? 'selected' : ''}>Summer Vacation Rush (+12% Leisure Surge)</option>
              </select>
            </div>

            <div class="space-y-1.5 pt-2">
              <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-slate-800">4. Last-Minute (T-7d) Booking Volume Share</span>
                <span class="font-black text-slate-800 text-sm">${s.lastMinuteSharePct}% of traffic</span>
              </div>
              <input type="range" min="5" max="40" step="1" value="${s.lastMinuteSharePct}" id="sim-lastminute-slider" class="w-full accent-slate-800">
              <div class="flex justify-between text-[10px] text-slate-400">
                <span>5% (Planned advance)</span>
                <span>22% (Normal)</span>
                <span>40% (Emergency crunch)</span>
              </div>
            </div>

          </div>

          <div class="lg:col-span-6 bg-gradient-to-b from-slate-900 to-[#0A192F] text-white rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
            <div>
              <div class="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                <span class="text-xs uppercase font-bold text-amber-400">Simulated Policy Projections</span>
                <span class="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">MoSPI Model Output</span>
              </div>

              <div class="grid grid-cols-2 gap-3 mb-4">
                <div class="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80">
                  <div class="text-[11px] text-slate-400">Projected Airfare Index</div>
                  <div class="text-2xl font-black text-white mt-0.5">${projectedAirfareIndex.toFixed(1)}</div>
                  <div class="text-[10px] text-rose-400 font-semibold">+${((projectedAirfareIndex - 108.4) / 108.4 * 100).toFixed(1)}% vs Current</div>
                </div>
                <div class="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80">
                  <div class="text-[11px] text-amber-300">True Journey Cost Index</div>
                  <div class="text-2xl font-black text-amber-400 mt-0.5">${projectedTrueJourneyIndex.toFixed(1)}</div>
                  <div class="text-[10px] text-amber-200 font-semibold">Includes ground transit</div>
                </div>
              </div>

              <div class="p-3.5 bg-slate-800/90 rounded-xl border border-slate-700/80 space-y-2 text-xs">
                <div class="flex justify-between text-slate-300">
                  <span>Impact on Transport & Comm Sub-group:</span>
                  <span class="font-bold text-white">${projectedTransportSubIndex.toFixed(1)} (+${(projectedTransportSubIndex - 114.2).toFixed(2)} pts)</span>
                </div>
                <div class="flex justify-between text-slate-300">
                  <span>Estimated Headline CPI Impact:</span>
                  <span class="font-black text-amber-400">+${cpiImpactBps.toFixed(1)} basis points (+${(cpiImpactBps / 100).toFixed(3)}%)</span>
                </div>
              </div>

              <div class="mt-4 p-3.5 bg-blue-900/40 rounded-xl border border-blue-700/60 text-xs text-blue-200 leading-relaxed">
                <strong>Plain-Language Brief:</strong> “If airfares rise by <strong>${s.nationalAirfarePct}%</strong> and airport transit costs rise by <strong>${s.groundTransitPct}%</strong>, the Effective Mobility Cost Index rises to <strong>${projectedTrueJourneyIndex.toFixed(1)}</strong>, adding <strong>+${cpiImpactBps.toFixed(1)} bps</strong> to headline national CPI.”
              </div>
            </div>

            <div class="text-[10px] text-slate-500 pt-2 border-t border-slate-800">
              Note: Model calibrates official NSO Base 2012 item weights for Transport & Communication (8.59%).
            </div>

          </div>

        </div>

        <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div class="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <div>
              <h3 class="font-bold text-sm text-slate-900">Baseline vs Simulated Shock Scenario Comparison</h3>
              <p class="text-xs text-slate-500">Real-time delta across key macroeconomic price aggregates</p>
            </div>
          </div>
          <div class="h-72 w-full">
            <canvas id="cpi-simulator-chart"></canvas>
          </div>
        </div>

      </div>
    `;

    setTimeout(() => {
      window.AeroPulseCharts.renderCPISimulatorChart('cpi-simulator-chart', simResults);

      document.getElementById('sim-airfare-slider')?.addEventListener('input', (e) => {
        this.simState.nationalAirfarePct = parseInt(e.target.value);
        this.renderCPISimulatorView();
      });

      document.getElementById('sim-transit-slider')?.addEventListener('input', (e) => {
        this.simState.groundTransitPct = parseInt(e.target.value);
        this.renderCPISimulatorView();
      });

      document.getElementById('sim-lastminute-slider')?.addEventListener('input', (e) => {
        this.simState.lastMinuteSharePct = parseInt(e.target.value);
        this.renderCPISimulatorView();
      });

      document.getElementById('sim-festival-select')?.addEventListener('change', (e) => {
        this.simState.festivalScenario = e.target.value;
        this.renderCPISimulatorView();
      });

    }, 50);
  }

  // ==========================================
  // DOWNLOAD CPI REPORT MODAL
  // ==========================================
  setupReportModal() {
    const modal = document.getElementById('report-modal');
    const closeBtn = document.getElementById('close-report-modal');
    closeBtn?.addEventListener('click', () => {
      modal?.classList.add('hidden');
    });
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  }

  openReportModal() {
    const modal = document.getElementById('report-modal');
    const container = document.getElementById('report-modal-content');
    if (!modal || !container) return;

    const meta = AeroPulseData.meta;

    container.innerHTML = `
      <div class="p-6 bg-white text-slate-900 space-y-6 max-h-[85vh] overflow-y-auto print:p-0">
        
        <div class="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500 via-orange-500 to-emerald-600 p-[2px] flex items-center justify-center shadow">
              <div class="w-full h-full bg-[#0A192F] rounded-md flex items-center justify-center font-black text-amber-400 text-sm">GOI</div>
            </div>
            <div>
              <div class="text-[11px] font-extrabold uppercase tracking-widest text-slate-600">Government of India • Ministry of Statistics and Programme Implementation</div>
              <h2 class="text-xl font-black text-slate-900 tracking-tight">Monthly Airfare Price Index & CPI Augmentation Report</h2>
              <div class="text-xs text-slate-500">Report Serial: NSO/CPI-AIR/2026-M09 | Official Airfare Index</div>
            </div>
          </div>
          <div class="text-right text-xs text-slate-600 hidden sm:block">
            <div class="font-bold text-slate-800">National Statistical Office</div>
            <div>Date of Release: 22 Sep 2026</div>
            <div class="text-emerald-700 font-semibold">Feed Status: Verified (A+)</div>
          </div>
        </div>

        <div class="bg-slate-50 border border-slate-300 rounded-xl p-4 space-y-2">
          <h4 class="font-black text-xs uppercase tracking-wider text-slate-900">Executive Summary for Policymakers</h4>
          <p class="text-xs text-slate-700 leading-relaxed">
            The National Airfare Price Index for September 2026 stands at <strong>${meta.nationalIndex}</strong>, representing a month-on-month increase of <strong>+${meta.monthlyChangePct}%</strong>. Simultaneously, the <strong>True Journey Cost Index</strong> reached <strong>${meta.trueJourneyCostIndex} (+${meta.trueJourneyMonthlyChangePct}%)</strong>, driven by ground airport transit fare increases in Bengaluru, Delhi, and Mumbai.
          </p>
        </div>

        <div>
          <h4 class="font-black text-xs uppercase tracking-wider text-slate-900 mb-2">Key Metric Summary</h4>
          <table class="w-full text-xs text-left border border-slate-300">
            <thead class="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
              <tr>
                <th class="p-2">Indicator Aggregate</th>
                <th class="p-2">Current Value</th>
                <th class="p-2">MoM Delta</th>
                <th class="p-2">Contribution to Transport CPI</th>
                <th class="p-2">Methodology Note</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <tr>
                <td class="p-2 font-bold">Traveller Price Index (TPI)</td>
                <td class="p-2 font-black text-slate-900">108.4</td>
                <td class="p-2 text-rose-700 font-bold">+6.2%</td>
                <td class="p-2">+14.2 bps</td>
                <td class="p-2 text-slate-500">Transacted checkout price with surge</td>
              </tr>
              <tr>
                <td class="p-2 font-bold">Pure Inflation Index (PII)</td>
                <td class="p-2 font-black text-emerald-800">104.3</td>
                <td class="p-2 text-emerald-700 font-bold">+2.8%</td>
                <td class="p-2">+6.1 bps</td>
                <td class="p-2 text-slate-500">Hedonically adjusted for festivals & weather</td>
              </tr>
              <tr>
                <td class="p-2 font-bold">True Journey Cost Index</td>
                <td class="p-2 font-black text-amber-800">112.1</td>
                <td class="p-2 text-amber-800 font-bold">+8.7%</td>
                <td class="p-2">+21.5 bps (Augmented)</td>
                <td class="p-2 text-slate-500">Includes door-to-airport ground connectivity</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="border border-slate-200 rounded-xl p-3">
            <h5 class="font-bold text-xs text-rose-800 mb-1">Top 3 Inflation Surge Corridors</h5>
            <ul class="text-xs space-y-1 text-slate-700">
              <li>• <strong>Delhi ⇄ Mumbai:</strong> ₹8,900 (+22.4% MoM) - Bucket depletion</li>
              <li>• <strong>Bengaluru ⇄ Kolkata:</strong> ₹9,450 (+18.6% MoM) - Pre-Puja rush</li>
              <li>• <strong>Mumbai ⇄ Goa:</strong> ₹6,800 (+16.2% MoM) - Post-monsoon tourism</li>
            </ul>
          </div>
          <div class="border border-slate-200 rounded-xl p-3">
            <h5 class="font-bold text-xs text-emerald-800 mb-1">Top 3 Stable / Cooling Corridors</h5>
            <ul class="text-xs space-y-1 text-slate-700">
              <li>• <strong>Chennai ⇄ Hyderabad:</strong> ₹2,850 (-8.4% MoM) - Vande Bharat effect</li>
              <li>• <strong>Delhi ⇄ Jaipur:</strong> ₹2,100 (-7.1% MoM) - Expressway substitution</li>
              <li>• <strong>Bengaluru ⇄ Kochi:</strong> ₹2,600 (-5.9% MoM) - Added capacity</li>
            </ul>
          </div>
        </div>

        <div class="space-y-2 border-t border-slate-200 pt-3">
          <h4 class="font-black text-xs uppercase tracking-wider text-slate-900">Statistical Recommendations for MoSPI CPI Division</h4>
          <ol class="list-decimal pl-4 text-xs text-slate-700 space-y-1 leading-relaxed">
            <li><strong>Adopt Pure Inflation Index (PII):</strong> Do not incorporate raw web-scraped airfare surges directly into national CPI. Use the hedonic PII (104.3) to insulate headline inflation from temporary festival capacity spikes.</li>
            <li><strong>Broaden Scope with True Journey Cost:</strong> Weighting flight tickets without ground airport connectivity distorts citizen travel inflation by 4-8 percentage points, particularly in high-growth UDAN airports.</li>
            <li><strong>Regularize T-7d Volatility Monitoring:</strong> High concentration in last-minute bookings creates artificial cost shocks for emergency travelers (+28.4% 6M inflation).</li>
          </ol>
        </div>

        <div class="border-t-2 border-slate-900 pt-3 flex items-center justify-between text-xs text-slate-600">
          <div>
            <div>Authenticated by: <strong>AeroPulse Automated Pipeline</strong></div>
            <div>Scraped Records Audited: <strong>48,290 observations today</strong></div>
          </div>
          <div class="text-right">
            <div class="font-bold text-slate-900">National Statistical Office (NSO)</div>
            <div>Ministry of Statistics & Programme Implementation</div>
            <div class="text-[10px] text-slate-500">AeroPulse Production Release</div>
          </div>
        </div>

        <div class="pt-4 flex justify-end gap-2 print:hidden">
          <button onclick="window.print()" class="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            <span>Print / Save as PDF</span>
          </button>
        </div>

      </div>
    `;

    modal.classList.remove('hidden');
  }

  // ==========================================
  // AIRPORT SEARCH KEYPAD & KEYWORD ENGINE
  // ==========================================
  setupAirportKeypadModal() {
    const modal = document.getElementById('airport-keypad-modal');
    const closeBtn = document.getElementById('close-airport-keypad');
    const cancelBtn = document.getElementById('airport-keypad-cancel');
    const searchInput = document.getElementById('airport-keypad-search-input');
    const clearBtn = document.getElementById('airport-keypad-clear-search');

    if (!modal) return;

    const closeModal = () => {
      modal.classList.add('hidden');
      this.keypadCallback = null;
    };

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeModal();
      }
    });

    clearBtn?.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        clearBtn.classList.add('hidden');
        searchInput.focus();
        this.renderKeypadList('');
      }
    });

    searchInput?.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      if (q) {
        clearBtn?.classList.remove('hidden');
      } else {
        clearBtn?.classList.add('hidden');
      }
      this.renderKeypadList(q);
    });

    // Keyboard navigation (Arrow keys + Enter)
    searchInput?.addEventListener('keydown', (e) => {
      const listEl = document.getElementById('airport-keypad-list');
      if (!listEl) return;
      const items = Array.from(listEl.querySelectorAll('.keypad-airport-item'));
      if (items.length === 0) return;

      let activeIndex = items.findIndex(item => item.classList.contains('bg-blue-50'));

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (activeIndex < items.length - 1) activeIndex++;
        else activeIndex = 0;
        this.highlightKeypadItem(items, activeIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (activeIndex > 0) activeIndex--;
        else activeIndex = items.length - 1;
        this.highlightKeypadItem(items, activeIndex);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && items[activeIndex]) {
          items[activeIndex].click();
        } else if (items[0]) {
          items[0].click();
        }
      }
    });
  }

  highlightKeypadItem(items, index) {
    items.forEach((it, i) => {
      if (i === index) {
        it.classList.add('bg-blue-50', 'border-blue-400', 'ring-1', 'ring-blue-400');
        it.scrollIntoView({ block: 'nearest' });
      } else {
        it.classList.remove('bg-blue-50', 'border-blue-400', 'ring-1', 'ring-blue-400');
      }
    });
  }

  openAirportKeypad(type, currentValue, onSelect) {
    const modal = document.getElementById('airport-keypad-modal');
    const titleEl = document.getElementById('airport-keypad-title');
    const subtitleEl = document.getElementById('airport-keypad-subtitle');
    const searchInput = document.getElementById('airport-keypad-search-input');
    const clearBtn = document.getElementById('airport-keypad-clear-search');
    const hubsContainer = document.getElementById('airport-keypad-quick-hubs');

    if (!modal) return;

    this.keypadCallback = onSelect;
    this.keypadType = type; // 'origin' or 'dest'

    if (titleEl) {
      titleEl.textContent = type === 'origin' ? 'Select Source (Origin) Airport' : 'Select Destination Airport';
    }
    if (subtitleEl) {
      subtitleEl.textContent = type === 'origin' ? 'Choose departure city or keyword' : 'Choose arrival city or keyword';
    }

    if (searchInput) {
      searchInput.value = '';
      clearBtn?.classList.add('hidden');
    }

    // Render Quick Hubs Keypad (Domestic & International Hubs)
    if (hubsContainer) {
      const topHubs = ['DEL', 'BOM', 'BLR', 'CCU', 'HYD', 'MAA', 'GOI', 'JAI', 'PAT', 'AMD', 'DXB', 'SIN', 'BKK', 'LHR', 'DOH', 'JFK'];
      const airports = AeroPulseData.airports;

      hubsContainer.innerHTML = topHubs.map(code => {
        const ap = airports[code] || { city: code, code };
        const isCurrent = code === currentValue;
        return `
          <button type="button" class="keypad-hub-btn px-2.5 py-1.5 rounded-lg border text-left transition transform active:scale-95 flex flex-col justify-center ${isCurrent ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-slate-800 border-slate-200'}" data-code="${code}">
            <div class="flex items-center justify-between">
              <span class="font-black text-xs font-mono">${code}</span>
              ${isCurrent ? '<span class="w-1.5 h-1.5 rounded-full bg-white"></span>' : ''}
            </div>
            <div class="text-[10px] truncate font-medium ${isCurrent ? 'text-blue-100' : 'text-slate-500'}">${ap.city}</div>
          </button>
        `;
      }).join('');

      // Add listener to hub buttons
      hubsContainer.querySelectorAll('.keypad-hub-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const code = btn.getAttribute('data-code');
          if (this.keypadCallback) this.keypadCallback(code);
          modal.classList.add('hidden');
        });
      });
    }

    // Render filtered list with empty query
    this.renderKeypadList('');

    modal.classList.remove('hidden');
    setTimeout(() => {
      searchInput?.focus();
    }, 50);
  }

  renderKeypadList(query) {
    const listEl = document.getElementById('airport-keypad-list');
    const countEl = document.getElementById('airport-keypad-count');
    const labelEl = document.getElementById('airport-keypad-results-label');
    if (!listEl) return;

    const airports = AeroPulseData.airports;
    const q = (query || '').toLowerCase().trim();

    const allCodes = Object.keys(airports);
    let matched = allCodes.filter(code => {
      if (!q) return true;
      const ap = airports[code];
      if (code.toLowerCase().includes(q)) return true;
      if (ap.city.toLowerCase().includes(q)) return true;
      if (ap.name.toLowerCase().includes(q)) return true;
      if (ap.state && ap.state.toLowerCase().includes(q)) return true;
      if (ap.keywords && ap.keywords.some(k => k.toLowerCase().includes(q))) return true;
      return false;
    });

    if (countEl) countEl.textContent = `${matched.length} relatable airport${matched.length === 1 ? '' : 's'}`;
    if (labelEl) labelEl.textContent = q ? `Matching Airports for "${q}"` : 'All Relatable Airports';

    if (matched.length === 0) {
      listEl.innerHTML = `
        <div class="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <div class="text-xs font-bold text-slate-600">No matching airports found for "${query}"</div>
          <p class="text-[11px] text-slate-400 mt-1">Try typing a city name like "Mumbai", state like "Bihar", or code like "DEL".</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = matched.map((code, idx) => {
      const ap = airports[code];
      const isSelected = (this.keypadType === 'origin' && code === this.searchOrigin) || (this.keypadType === 'dest' && code === this.searchDest);
      const tierBadge = ap.tier === 1 ? 'Metro Hub' : (ap.tier === 3 ? 'UDAN Regional' : 'Tier-2 Corridor');
      const badgeColor = ap.tier === 1 ? 'bg-blue-100 text-blue-800 border-blue-200' : (ap.tier === 3 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200');

      return `
        <div class="keypad-airport-item p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${idx === 0 && q ? 'bg-blue-50 border-blue-300' : (isSelected ? 'bg-slate-50 border-slate-300' : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/50')}" data-code="${code}">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-900 to-blue-950 text-white font-mono font-black text-sm flex items-center justify-center shrink-0 shadow-sm border border-slate-700">
              ${code}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-black text-sm text-slate-900">${ap.city}</span>
                <span class="text-[10px] font-bold px-1.5 py-0.2 rounded border ${badgeColor}">${tierBadge}</span>
              </div>
              <div class="text-[11px] text-slate-500 font-medium truncate max-w-[280px] sm:max-w-md">${ap.name} • ${ap.state}</div>
            </div>
          </div>

          <div class="text-right shrink-0">
            <div class="text-[10px] text-slate-400">Ground: ₹${ap.avgTransitCost} avg</div>
            <div class="text-[11px] font-bold text-blue-600 flex items-center gap-1 justify-end">
              <span>Select</span>
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners to item cards
    listEl.querySelectorAll('.keypad-airport-item').forEach(item => {
      item.addEventListener('click', () => {
        const code = item.getAttribute('data-code');
        if (this.keypadCallback) this.keypadCallback(code);
        const modal = document.getElementById('airport-keypad-modal');
        modal?.classList.add('hidden');
      });
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.aeroApp = new AeroPulseApp();
  window.aeroApp.init();
});
