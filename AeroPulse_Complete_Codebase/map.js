/**
 * AeroPulse India - Real Interactive Geographic GIS Aviation Map
 * Powered by Leaflet.js with High-Performance ESRI ArcGIS World Street Map
 */

class AeroPulseMap {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = Object.assign({
      filter: 'all', // 'all', 'surge', 'stable'
      onSelectRoute: null,
      onSelectAirport: null
    }, options);
    this.map = null;
    this.markers = {};
    this.routePolylines = [];
    this.activeRouteLine = null;
    this.init();
  }

  init() {
    const el = document.getElementById(this.containerId);
    if (!el) return;

    // Check if Leaflet is loaded
    if (!window.L) {
      console.warn("Leaflet.js not loaded. Retrying in 200ms...");
      setTimeout(() => this.init(), 200);
      return;
    }

    // Clear previous Leaflet instance if container already had one
    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    // Build container layout with toolbar and Leaflet div
    el.innerHTML = `
      <div class="relative w-full h-[720px] bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-xl flex flex-col">
        
        <!-- Real Map Toolbar -->
        <div class="z-20 flex flex-wrap items-center justify-between gap-3 bg-[#0A192F]/95 backdrop-blur-md px-4 py-3 border-b border-slate-700/80 shadow-md">
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </span>
            <div>
              <div class="flex items-center gap-2">
                <h4 class="text-sm font-bold text-white tracking-tight">Interactive Aviation Network</h4>
                <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">ESRI World Layer</span>
              </div>
              <p class="text-xs text-slate-400 mt-0.5">Real-Time Domestic & International Air Corridors</p>
            </div>
          </div>

          <!-- Filter buttons -->
          <div class="flex items-center gap-2 text-xs">
            <button class="map-filter-btn px-3 py-1.5 rounded-lg font-medium transition ${this.options.filter === 'all' ? 'bg-blue-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}" data-filter="all">All Corridors</button>
            <button class="map-filter-btn px-3 py-1.5 rounded-lg font-medium transition ${this.options.filter === 'surge' ? 'bg-rose-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}" data-filter="surge">Surge Hotspots (>+10%)</button>
            <button class="map-filter-btn px-3 py-1.5 rounded-lg font-medium transition ${this.options.filter === 'stable' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}" data-filter="stable">Stable / Falling</button>
            <button id="map-reset-btn" class="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold ml-1 border border-slate-700">Reset View</button>
          </div>
        </div>

        <!-- Real Leaflet Map Mount Point -->
        <div id="leaflet-map-element" class="flex-1 w-full h-full z-10"></div>

        <!-- Map Footer Legend -->
        <div class="z-20 flex flex-wrap items-center justify-between gap-3 text-xs bg-[#0A192F]/95 backdrop-blur-md border-t border-slate-700/80 py-2.5 px-4 text-slate-300">
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-1.5">
              <span class="w-3 h-3 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50"></span>
              <span class="text-xs">Surge Hotspot (&gt; +10%)</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
              <span class="text-xs">Stable Corridors</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-3 h-3 rounded-full bg-blue-500"></span>
              <span class="text-xs">Airport Gateway</span>
            </div>
          </div>
          <div class="text-xs text-slate-400">
            Click any airport pin or flight arc to inspect corridor fare dynamics
          </div>
        </div>

      </div>
    `;

    // Initialize Leaflet Map centered on India
    const mapElement = document.getElementById('leaflet-map-element');
    this.map = L.map(mapElement, {
      center: [22.0, 79.5],
      zoom: 5,
      minZoom: 4,
      maxZoom: 10,
      zoomControl: true,
      attributionControl: false
    });

    // Add High-Performance, High-DPI ESRI ArcGIS World Street Map Layer (Global CDN, No Watermark, No Key Required)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18,
      attribution: '&copy; Esri &copy; OpenStreetMap'
    }).addTo(this.map);

    // Auto-fit and invalidate size to guarantee zero gray blocks and instant full rendering
    setTimeout(() => { this.map?.invalidateSize(); }, 50);
    setTimeout(() => { this.map?.invalidateSize(); }, 200);
    setTimeout(() => { this.map?.invalidateSize(); }, 600);

    // Add Airports and Corridors
    this.renderAirports();
    this.renderCorridors();

    // Attach Toolbar Events
    this.attachToolbarEvents();

    window.addEventListener('resize', () => {
      this.map?.invalidateSize();
    });
  }

  renderAirports() {
    const airports = AeroPulseData.airports;

    Object.keys(airports).forEach(code => {
      const ap = airports[code];
      const isIntl = ap.isInternational;
      const isSurge = ["DEL", "BOM", "BLR", "CCU", "PAT", "GOI", "GAU"].includes(code);
      const isStable = ["MAA", "HYD", "JAI", "AMD", "COK"].includes(code);

      const color = isIntl ? '#6366F1' : (isSurge ? '#EF4444' : (isStable ? '#10B981' : '#2563EB'));
      const badgeBg = isIntl ? 'background: #4F46E5;' : (isSurge ? 'background: #EF4444;' : (isStable ? 'background: #10B981;' : 'background: #2563EB;'));
      const pulseHtml = isSurge ? `<div class="absolute -inset-1.5 rounded-full bg-rose-500 opacity-60 animate-ping"></div>` : (isIntl ? `<div class="absolute -inset-1 rounded-full bg-indigo-500 opacity-50 animate-pulse"></div>` : '');

      const customIcon = L.divIcon({
        className: 'custom-airport-marker',
        html: `
          <div class="relative flex flex-col items-center cursor-pointer group" style="transform: translate(-50%, -50%);">
            ${pulseHtml}
            <div class="relative px-2 py-0.5 rounded-md text-white font-black text-[10px] shadow-lg flex items-center gap-1 border border-white/70" style="${badgeBg}">
              <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path></svg>
              <span>${code}</span>
            </div>
            <div class="text-[9px] font-bold text-slate-800 bg-white/95 px-1.5 rounded shadow-sm mt-0.5 whitespace-nowrap border border-slate-200">
              ${ap.city}
            </div>
          </div>
        `,
        iconSize: [60, 40],
        iconAnchor: [30, 20]
      });

      const marker = L.marker([ap.lat, ap.lng], { icon: customIcon }).addTo(this.map);

      // Popup Content
      const popupHtml = `
        <div class="p-1 min-w-[200px] text-slate-900 font-sans">
          <div class="flex items-center justify-between border-b border-slate-200 pb-1 mb-1">
            <strong class="text-sm font-black text-slate-900">${ap.city} (${code})</strong>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${isSurge ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}">
              ${isSurge ? 'Surge Alert' : 'Stable'}
            </span>
          </div>
          <div class="text-xs text-slate-500 mb-2">${ap.name}</div>
          <div class="bg-slate-50 p-2 rounded-lg text-xs space-y-1 border border-slate-200">
            <div class="flex justify-between">
              <span class="text-slate-500">City Ground Transit:</span>
              <strong class="text-amber-800 font-bold">₹${ap.avgTransitCost} avg</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Average Transit Time:</span>
              <strong class="text-slate-800 font-bold">${ap.transitTimeMins} mins</strong>
            </div>
          </div>
          <button class="mt-2 w-full px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs transition select-airport-btn" data-code="${code}">
            Search Flights from ${code} →
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on('popupopen', () => {
        const btn = document.querySelector(`.select-airport-btn[data-code="${code}"]`);
        btn?.addEventListener('click', () => {
          if (typeof this.options.onSelectAirport === 'function') {
            this.options.onSelectAirport(code);
          }
        });
      });

      this.markers[code] = marker;
    });
  }

  renderCorridors() {
    // Clear old lines
    this.routePolylines.forEach(p => this.map.removeLayer(p));
    this.routePolylines = [];

    const airports = AeroPulseData.airports;
    const corridors = [
      { from: "DEL", to: "BOM", status: "surge", change: "+22.4%", fare: "₹8,900", color: "#EF4444", weight: 3.5 },
      { from: "BLR", to: "CCU", status: "surge", change: "+18.6%", fare: "₹9,450", color: "#F97316", weight: 3 },
      { from: "BOM", to: "GOI", status: "surge", change: "+16.2%", fare: "₹6,800", color: "#F59E0B", weight: 2.5 },
      { from: "DEL", to: "PAT", status: "surge", change: "+14.8%", fare: "₹7,950", color: "#EF4444", weight: 3 },
      { from: "CCU", to: "GAU", status: "surge", change: "+12.3%", fare: "₹5,200", color: "#F97316", weight: 2.5 },
      { from: "DEL", to: "JAI", status: "stable", change: "-7.1%", fare: "₹2,100", color: "#10B981", weight: 2.5 },
      { from: "MAA", to: "HYD", status: "stable", change: "-8.4%", fare: "₹2,850", color: "#10B981", weight: 2.5 },
      { from: "BLR", to: "COK", status: "stable", change: "-5.9%", fare: "₹2,600", color: "#10B981", weight: 2 },
      { from: "BOM", to: "AMD", status: "stable", change: "-4.8%", fare: "₹2,900", color: "#10B981", weight: 2 },
      { from: "BLR", to: "BOM", status: "surge", change: "+11.5%", fare: "₹5,200", color: "#F97316", weight: 2.8 },
      { from: "DEL", to: "DXB", status: "international", change: "+14.2%", fare: "₹12,450", color: "#6366F1", weight: 3.5 },
      { from: "BOM", to: "SIN", status: "international", change: "+8.9%", fare: "₹17,900", color: "#8B5CF6", weight: 3.2 }
    ];

    const filtered = corridors.filter(c => {
      if (this.options.filter === 'surge') return c.status === 'surge';
      if (this.options.filter === 'stable') return c.status === 'stable';
      return true;
    });

    filtered.forEach(c => {
      const p1 = airports[c.from];
      const p2 = airports[c.to];
      if (!p1 || !p2) return;

      // Create intermediate curve coordinate for curved flight look
      const midLat = (p1.lat + p2.lat) / 2 + (p2.lng - p1.lng) * 0.08;
      const midLng = (p1.lng + p2.lng) / 2 - (p2.lat - p1.lat) * 0.08;

      const latlngs = [
        [p1.lat, p1.lng],
        [midLat, midLng],
        [p2.lat, p2.lng]
      ];

      const polyline = L.polyline(latlngs, {
        color: c.color,
        weight: c.weight,
        opacity: 0.85,
        dashArray: '6, 6',
        lineCap: 'round'
      }).addTo(this.map);

      polyline.bindTooltip(`
        <div class="font-sans text-xs">
          <strong>${c.from} ⇄ ${c.to}</strong>: <span class="font-bold text-slate-800">${c.fare}</span> (${c.change})
        </div>
      `, { sticky: true });

      polyline.on('click', () => {
        if (typeof this.options.onSelectRoute === 'function') {
          this.options.onSelectRoute(`${c.from}-${c.to}`);
        }
      });

      this.routePolylines.push(polyline);
    });
  }

  highlightRoute(fromCode, toCode) {
    const ap1 = AeroPulseData.airports[fromCode];
    const ap2 = AeroPulseData.airports[toCode];
    if (!ap1 || !ap2 || !this.map) return;

    if (this.activeRouteLine) {
      this.map.removeLayer(this.activeRouteLine);
      this.activeRouteLine = null;
    }

    const route = AeroPulseData.getRoute ? AeroPulseData.getRoute(fromCode, toCode) : null;
    const fareStr = route ? `₹${route.currentFare.toLocaleString('en-IN')}` : 'Analyzing';
    const varianceStr = route ? `${route.variancePct > 0 ? '+' : ''}${route.variancePct}%` : '';
    const color = route && route.variancePct > 20 ? '#EF4444' : (route && route.variancePct < 0 ? '#10B981' : '#2563EB');

    const midLat = (ap1.lat + ap2.lat) / 2 + (ap2.lng - ap1.lng) * 0.1;
    const midLng = (ap1.lng + ap2.lng) / 2 - (ap2.lat - ap1.lat) * 0.1;

    this.activeRouteLine = L.polyline([[ap1.lat, ap1.lng], [midLat, midLng], [ap2.lat, ap2.lng]], {
      color: color,
      weight: 5,
      opacity: 0.95
    }).addTo(this.map);

    this.activeRouteLine.bindTooltip(`
      <div class="px-2 py-1 font-sans text-xs">
        <strong class="text-slate-900">${ap1.city} (${fromCode}) ⇄ ${ap2.city} (${toCode})</strong><br>
        <span class="font-black text-blue-600">${fareStr}</span> <span class="font-bold text-slate-500">(${varianceStr})</span>
      </div>
    `, { permanent: true, direction: 'top', className: 'shadow-lg rounded-lg border border-slate-300' }).openTooltip([midLat, midLng]);

    // Fit map bounds to view both cities nicely with size invalidation
    this.map.invalidateSize();
    const bounds = L.latLngBounds([[ap1.lat, ap1.lng], [ap2.lat, ap2.lng]]);
    this.map.fitBounds(bounds, { padding: [70, 70], maxZoom: 6, animate: true });
  }

  setFilter(filter) {
    this.options.filter = filter;
    this.renderCorridors();

    const btns = document.querySelectorAll('.map-filter-btn');
    btns.forEach(b => {
      if (b.getAttribute('data-filter') === filter) {
        b.className = 'map-filter-btn px-2.5 py-1 rounded-lg font-medium transition bg-blue-600 text-white shadow';
      } else {
        b.className = 'map-filter-btn px-2.5 py-1 rounded-lg font-medium transition bg-slate-800 text-slate-300 hover:bg-slate-700';
      }
    });
  }

  attachToolbarEvents() {
    const btns = document.querySelectorAll('.map-filter-btn');
    btns.forEach(b => {
      b.addEventListener('click', (e) => {
        const filter = e.target.getAttribute('data-filter');
        this.setFilter(filter);
      });
    });

    const resetBtn = document.getElementById('map-reset-btn');
    resetBtn?.addEventListener('click', () => {
      this.map?.setView([22.0, 79.5], 5);
      if (this.activeRouteLine) {
        this.map?.removeLayer(this.activeRouteLine);
        this.activeRouteLine = null;
      }
    });
  }
}

window.AeroPulseMap = AeroPulseMap;
