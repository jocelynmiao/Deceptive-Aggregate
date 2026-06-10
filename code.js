let historicalData    = null;
let projectedData     = null;
let geoDataGlobal     = null;
let climateDataGlobal = null;

// Seasonal caches: { historical: { global, country, us }, ssp245: { ... } }
const seasonalCache = { historical: {}, ssp245: {} };

let currentYear  = 1851;
let currentSlide = 0;

const tooltip = d3.select("#d3-tooltip");

function showTip(event, html) {
  tooltip.style("display", "block")
    .style("left",  (event.clientX + 14) + "px")
    .style("top",   (event.clientY - 36) + "px")
    .html(html);
}
function hideTip() { tooltip.style("display", "none"); }

function anomalyColor(min = -1, mid = 0, max = 3) {
  // 7 discrete bins across the diverging RdBu range
  const continuous = d3.scaleDiverging(t => d3.interpolateRdBu(1 - t))
    .domain([min, mid, max]);
  return d3.scaleQuantize()
    .domain([min, max])
    .range(d3.quantize(t => continuous(min + t * (max - min)), 7));
}

function aggregateByYear(rows) {
  const byYear = d3.group(rows, d => +d.year);
  return Array.from(byYear, ([year, entries]) => ({
    year,
    temp: d3.mean(entries, d => +d.mean_temp)
  })).sort((a, b) => a.year - b.year);
}

// Slide defs

const slides = [
  {
  label: "Prologue/New Introduction",
  content: `
    <div style="height:100%;display:flex;align-items:center;justify-content:center;text-align:center;">
      <div style="max-width:900px;">
        <p class="eyebrow" style="margin-bottom:32px;">A note before we begin</p>
        <h1 style="font-family:var(--font-head);font-size:clamp(1.8rem, 3.4vw, 3rem);font-weight:900;line-height:1.25;letter-spacing:-0.01em;color:var(--text);margin-bottom:0;">
          Climate change is a real phenomenon<br>
          that everyone has been exposed to.<br><br>
          But the extent to which they have<br>
          <em style="font-style:italic;color:var(--accent);">may have been deceiving.</em>
        </h1>
        <p style="margin-top:48px;opacity:0.55;font-style:italic;font-family:var(--font-ui);font-size:1rem;max-width:560px;margin-left:auto;margin-right:auto;">
          What follows is an examination of how the way we visualize climate<br>
          shapes — and sometimes obscures — what we let ourselves understand.
        </p>
        <p style="margin-top:60px;font-family:var(--font-ui);font-size:0.72rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);">
          Press <strong style="color:var(--accent);">Next</strong> or → to begin
        </p>
      </div>
    </div>`
},
  {
    label: "Overall Global Temperature",
    content: `
      <div class="slide-layout">
        <div class="text-panel">
          <h3>Slide 01 — The Aggregate</h3>
          <h2>Average Global<br>Temperature</h2>
          <p>Climate change is often presented on a global scale ...</p>
          <div style="margin-top:20px;">
            <div class="year-display" id="year-label" style="font-size:2rem;font-weight:700;color:var(--accent);">1850</div>
            <div id="globe-temp-readout" style="margin-top:8px;font-family:var(--font-ui);font-size:0.8rem;color:var(--muted);">
              Animating through years…
            </div>
          </div>
          <div class="colorbar-wrap" style="margin-top:24px;">
            <span>0°C</span>
            <div class="colorbar"></div>
            <span>30°C</span>
          </div>
        </div>
        <div id="map"></div>
      </div>`
  },
  {
    label: "Global Temperature Trend",
    content: `
      <div class="chart-header">
        <h3>Slide 02 — Historical Record &amp; Projections</h3>
        <h1>Global Mean Surface Temperature</h1>
        <p class="chart-subhead">... and our projections of the future often display this single metric. After all, doesn't this projection look intimidating?</p>
      </div>
      <div id="chart-controls">
        <button class="chart-btn" id="btn-project">+ Show Projected (SSP2-4.5)</button>
        <button class="chart-btn secondary" id="btn-reset" disabled>Reset to Historical</button>
      </div>
      <div id="chart"></div>
      <div id="legend">
        <span><span class="legend-swatch" style="background:#4a90c4"></span>Historical (CMIP6)</span>
        <span id="legend-proj" style="display:none">
          <span class="legend-swatch" style="background:#c0392b"></span>Projected SSP2-4.5
        </span>
      </div>`
  },
  {
    label: "Country-Level Breakdown",
    content: `
      <div class="slide-layout">
        <div class="text-panel">
          <h3>Slide 03 — Geographic Disaggregation</h3>
          <h2>Average Temperature<br>by Country</h2>
          <p>But a lot can be revealed by looking at the country-level data. Move the slider ... etc</p>
          <div style="margin-top:20px;">
            <input id="year-slider" type="range" min="1850" max="2014" step="1" value="1900">
            <div class="year-display" id="year-label">1851</div>
          </div>
          <div class="colorbar-wrap" style="margin-top:28px;">
            <span>0°C</span>
            <div class="colorbar"></div>
            <span>30°C</span>
          </div>
        </div>
        <div id="map"></div>
      </div>`
  },
  // Slide 4
  {
    label: "Zooming Into the U.S.",
    content: `
    <div class="slide-layout">
      <div class="text-panel">
        <h3>Slide 04 — Localizing Climate Change</h3>
        <h2>Zooming Into<br>the United States</h2>
        <p>
          Global temperature trends provide a useful overview, but they can hide
          regional differences. Let's take a closer look at the United States
          in <strong style="color:var(--accent)">1850</strong>.
        </p>
        <div id="comparison-cards">
          <div class="stat-card">
            <div class="stat-value" id="global-temp-readout">--</div>
            <div class="stat-label">Global Average (1850)</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" id="us-temp-readout">--</div>
            <div class="stat-label">United States Average (1850)</div>
          </div>
        </div>
        <p style="margin-top:20px;font-size:0.8rem;color:var(--muted);">
          Hit <strong>Next</strong> to see how U.S. temperatures shift by 2014.
        </p>
      </div>
      <div id="us-map"></div>
    </div>`
  },
  // Slide 5
  {
    label: "U.S. Temperatures by 2014",
    content: `
    <div class="slide-layout">
      <div class="text-panel">
        <h3>Slide 05 — Present Day</h3>
        <h2>The U.S. in <span style="color:var(--red)">2014</span></h2>
        <p>
          By isolating the country, it is clear the U.S. has warmed significantly. How does it compare globally?
        </p>
        <div id="comparison-cards">
          <div class="stat-card">
            <div class="stat-value" id="global-temp-readout-5">--</div>
            <div class="stat-label">Global Average (2014)</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" id="us-temp-readout-5">--</div>
            <div class="stat-label">United States Average (2014)</div>
          </div>
          <div class="stat-card" id="delta-card" style="margin-top:12px;">
            <div class="stat-value" id="delta-readout" style="font-size:1.6rem;">--</div>
            <div class="stat-label">U.S. Change vs. Global Change since 1850</div>
          </div>
        </div>
      </div>
      <div id="us-map-5"></div>
    </div>`
  },
  // Slide 6
  {
  label: "Is This Enough?",
  content: `
    <div class="text-slide question-slide">
      <p class="eyebrow">Slide 06 — Reflection</p>
      <h1>It's not that they're wrong.<br>They were just<br><em>built for someone else.</em></h1>
 
      <p class="lead" style="margin-top:24px;">
        Aggregates aren't dishonest. Every visualization is a decision — a trade
        between detail and legibility — and the more we zoom out, the more we
        trade away. The deception, if there is one, isn't malicious. It's that
        the picture was framed for a specific reader, and we inherit it without
        noticing what got taken away from the our view.
      </p>
 
      <blockquote style="border-left:3px solid var(--accent);padding-left:24px;margin:32px 0;font-family:var(--font-head);font-size:1.35rem;font-style:italic;color:var(--text);line-height:1.5;max-width:680px;">
        A global average is useful for the audiences who already think globally
        — policymakers, treaties, news cycles. For everyone else, it can hide
        the climate they actually live in.
      </blockquote>
 
      <p style="margin-top:20px;">
        Each step we've taken so far has been a small trade-off in the
        opposite direction — closer to lived experience, further from the
        clean global summary:
      </p>
 
      <div class="question-pills">
        <div class="q-pill">Country views are closer to lived experience — but still hide regional differences within a country.</div>
        <div class="q-pill">Annual averages flatten the year you actually remember — the summers, the winters, the harvest months.</div>
        <div class="q-pill">National numbers serve national conversations. They don't necessarily serve the people having local ones.</div>
      </div>
 
      <p style="margin-top:28px;">
        So what happens if we look at the seasons people <em>actually experience</em> —
        the winters that keep getting shorter, the summers that keep getting hotter?
      </p>
    </div>`
},
  // Slide 7
  {
    label: "Winter vs Summer — World",
    content: `
      <div class="slide-layout">
        <div class="text-panel">
          <h3>Slide 07 — Seasonal View</h3>
          <h2>Winters &amp; Summers<br>Around the World</h2>
          <p>
            Looking even deeper, we can see how our seasons have changed in
            temperatures across the world.
          </p>
          <div class="season-toggle" style="margin-top:20px;">
            <button class="season-btn active" id="btn-winter">❄️ Winter</button>
            <button class="season-btn" id="btn-summer">☀️ Summer</button>
          </div>
          <div style="margin-top:20px;">
            <input id="year-slider-7" type="range" min="1850" max="2014" step="1" value="1900">
            <div class="year-display" id="year-label-7">1851</div>
          </div>
          <div class="colorbar-wrap" style="margin-top:20px;">
            <span id="colorbar-low-label">−10°C</span>
            <div class="colorbar colorbar-div" id="colorbar-7"></div>
            <span id="colorbar-high-label">35°C</span>
          </div>
        </div>
        <div id="map-7"></div>
      </div>`
  },
  // Slide 8
  {
    label: "U.S. Winter Projections",
    content: `
    <div class="slide-layout">
      <div class="text-panel">
        <h3>Slide 08 — U.S. Winter Trend</h3>
        <h2>U.S. Winters Are<br>Getting Warmer</h2>
        <p>
          Focusing on U.S. winters, we can see a clear warming trend from 1850
          to the end of the projection period.
        </p>
        <div id="comparison-cards">
          <div class="stat-card">
            <div class="stat-value" id="us-winter-1850">--</div>
            <div class="stat-label">U.S. Winter Avg (1850)</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" id="us-winter-latest">--</div>
            <div class="stat-label">U.S. Winter Avg (latest projected)</div>
          </div>
          <div class="stat-card" style="margin-top:12px;">
            <div class="stat-value" id="us-winter-delta" style="color:var(--red);">--</div>
            <div class="stat-label">Projected Warming (winters)</div>
          </div>
        </div>
      </div>
      <div id="us-map-8"></div>
    </div>`
  },
  // Slide 9
  {
    label: "U.S. Summer Projections",
    content: `
    <div class="slide-layout">
      <div class="text-panel">
        <h3>Slide 09 — U.S. Summer Trend</h3>
        <h2>U.S. Summers Are<br>Getting Hotter</h2>
        <p>
          And summers tell an equally stark story. The same projection applied
          to summer months paints a different picture.
        </p>
        <div id="comparison-cards">
          <div class="stat-card">
            <div class="stat-value" id="us-summer-1850">--</div>
            <div class="stat-label">U.S. Summer Avg (1850)</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" id="us-summer-latest">--</div>
            <div class="stat-label">U.S. Summer Avg (latest projected)</div>
          </div>
          <div class="stat-card" style="margin-top:12px;">
            <div class="stat-value" id="us-summer-delta" style="color:var(--red);">--</div>
            <div class="stat-label">Projected Warming (summers)</div>
          </div>
        </div>
      </div>
      <div id="us-map-9"></div>
    </div>`
  },
  // Slide 10
  {
  label: "Visualization Tradeoffs",
  content: `
    <div class="slide-layout slide-layout-wide">
      <div class="text-panel" style="min-width:300px;">
        <h3>Slide 10 — Explore</h3>
        <h2>The Tradeoffs of<br>Each Scale</h2>
        <p>
          Each level of detail tells a different story. Use the controls
          below to explore — and consider which view best matches your
          audience.
        </p>
 
        <div id="slide10-controls" style="margin:18px 0 22px; padding:14px; border:1px solid var(--border); background:rgba(255,255,255,0.02);">
 
          <!-- Level toggle (OPTION B: enables when "World" is activated) -->
          <div style="margin-bottom:12px;">
            <div style="font-family:var(--font-ui);font-size:0.7rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">Level</div>
            <div class="season-toggle">
              <button class="season-btn active" id="btn-10-us">🇺🇸 U.S.</button>
              <button class="season-btn" id="btn-10-countries">🌍 Countries</button>
              <button class="season-btn" id="btn-10-global">🌐 Global</button>
            </div>
          </div>
 
          <!-- Season toggle -->
          <div style="margin-bottom:12px;">
            <div style="font-family:var(--font-ui);font-size:0.7rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">Season</div>
            <div class="season-toggle">
              <button class="season-btn active" id="btn-10-winter">❄️ Winter</button>
              <button class="season-btn" id="btn-10-summer">☀️ Summer</button>
              <button class="season-btn" id="btn-10-annual">📅 Annual</button>
            </div>
          </div>
 
          <!-- Year slider -->
          <div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
              <div style="font-family:var(--font-ui);font-size:0.7rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;">Year</div>
              <div class="year-display" id="year-label-10" style="font-size:1.3rem;">1851</div>
            </div>
            <input id="year-slider-10" type="range" min="1850" max="2100" step="1" value="2014">
            <div id="year-source-10" style="font-family:var(--font-ui);font-size:0.7rem;color:var(--muted);margin-top:4px;">Historical (CMIP6)</div>
          </div>
 
        </div>
 
        <div class="tradeoff-list">
          <div class="tradeoff-row" data-level="global">
            <span class="tradeoff-icon"></span>
            <div><strong>Global scale</strong> — Fastest to interpret climate change broadly, but least personal.</div>
          </div>
          <div class="tradeoff-row" data-level="country">
            <span class="tradeoff-icon"></span>
            <div><strong>Country level</strong> — Easier to interpret; more relevant for general audiences.</div>
          </div>
          <div class="tradeoff-row" data-level="annual">
            <span class="tradeoff-icon"></span>
            <div><strong>Annual averages</strong> — Simpler, but hides seasonal extremes people actually feel.</div>
          </div>
          <div class="tradeoff-row active-row" data-level="state">
            <span class="tradeoff-icon"></span>
            <div><strong>State level</strong> — Highly relatable for U.S. audiences; requires aggregating specific information.</div>
          </div>
        </div>
 
        <p style="margin-top:20px;font-size:0.85rem;">
          <em>So — who is our audience, and how do we most efficiently convey our message?</em>
        </p>
      </div>
      <div id="us-map-10" style="flex:1;min-height:420px;display:flex;flex-direction:column;gap:12px;">
        <div id="us-map-10-map" style="flex:1;min-height:280px;position:relative;"></div>
        <div id="us-map-10-chart" style="height:200px;display:none;background:rgba(255,255,255,0.02);border:1px solid var(--border);padding:8px 12px;position:relative;">
          <button id="us-map-10-chart-close" title="Close" style="position:absolute;top:6px;right:8px;background:transparent;border:none;color:var(--muted);cursor:pointer;font-size:1.1rem;line-height:1;padding:2px 6px;">×</button>
        </div>
    </div>
  </div>`
}
];

// Render

function render(direction = 1) {
  const slide = slides[currentSlide];

  document.getElementById("slide-label").textContent = slide.label;

  const pct = (currentSlide / (slides.length - 1)) * 100;
  document.getElementById("progress-bar-fill").style.width = pct + "%";

  document.getElementById("prev-btn").disabled = currentSlide === 0;
  document.getElementById("next-btn").disabled = currentSlide === slides.length - 1;
  document.getElementById("restart-btn").style.display = currentSlide === slides.length - 1 ? "inline-flex" : "none";
  
  const contentEl = document.getElementById("content");
  contentEl.classList.remove("visible");
  contentEl.style.transform = `translateX(${direction > 0 ? "40px" : "-40px"})`;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      contentEl.innerHTML = slide.content;
      contentEl.style.transform = "";
      contentEl.classList.add("visible");

      if (slide.label === "Overall Global Temperature") slideOneMap();
      if (slide.label === "Global Temperature Trend")  slideTwoChart();
      if (slide.label === "Country-Level Breakdown")   slideThreeMap();
      if (slide.label === "Zooming Into the U.S.")     slideFourUS();
      if (slide.label === "U.S. Temperatures by 2014") slideFiveUS();
      if (slide.label === "Winter vs Summer — World")  slideSevenWorld();
      if (slide.label === "U.S. Winter Projections")   slideEightUSWinter();
      if (slide.label === "U.S. Summer Projections")   slideNineUSSummer();
      if (slide.label === "Visualization Tradeoffs")   slideTenUSStates();
    });
  });
}

function changeSlide(dir) {
  // Cancel any running slide-1 animation when leaving
  if (window._slide1AnimCancel) {
    window._slide1AnimCancel();
    window._slide1AnimCancel = null;
  }
  currentSlide = Math.max(0, Math.min(slides.length - 1, currentSlide + dir));
  render(dir);
}

render(1);
document.getElementById("prev-btn").addEventListener("click", () => changeSlide(-1));
document.getElementById("next-btn").addEventListener("click", () => changeSlide(1));
window.addEventListener("keydown", e => {
  if (e.key === "ArrowRight" || e.key === "ArrowDown") changeSlide(1);
  if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   changeSlide(-1);
});
document.getElementById("restart-btn").addEventListener("click", () => {currentSlide = 0; render(1);});

// Data loaders

async function ensureBaseData() {
  if (!geoDataGlobal || !climateDataGlobal) {
    [geoDataGlobal, climateDataGlobal] = await Promise.all([
      d3.json("data/world.geojson"),
      d3.csv("data/yearly_country_temp_historical.csv")
    ]);
  }
}

async function ensureSeasonalData(scope, scenario) {
  if (!seasonalCache[scenario][scope]) {
    const fname = `data/seasonal_${scope}_temp_${scenario}.csv`;
    seasonalCache[scenario][scope] = await d3.csv(fname);
  }
  return seasonalCache[scenario][scope];
}

function lookupSeasonalTemp(rows, year, season, country = null) {
  let filtered = rows.filter(r => +r.year === year && r.season === season);
  if (country) {
    filtered = filtered.filter(r =>
      r.country === country ||
      r.country === "United States of America"
    );
  }
  if (!filtered.length) return null;
  const vals = filtered.map(r => +r.mean_temp).filter(v => !isNaN(v));
  return vals.length ? d3.mean(vals) : null;
}


function buildSeasonalTempMap(rows, year, season) {
  return new Map(
    rows
      .filter(r => +r.year === year && r.season === season)
      .map(r => [r.country, +r.mean_temp])
  );
}

function getGlobalAvg(year) {
  const rows = climateDataGlobal.filter(d => +d.year === year);
  return rows.length ? d3.mean(rows, d => +d.mean_temp) : null;
}

function getCountryAnnualTemp(year, ...names) {
  for (const name of names) {
    const row = climateDataGlobal.find(d => +d.year === year && d.country === name);
    if (row) return +row.mean_temp;
  }
  return null;
}

//name fixes

const nameFixes = {
  "The Bahamas":                        "Bahamas",
  "Bosnia and Herzegovina":             "Bosnia and Herz.",
  "Brunei":                             "Brunei Darussalam",
  "Central African Republic":           "Central African Rep.",
  "Ivory Coast":                        "Côte d'Ivoire",
  "Democratic Republic of the Congo":   "Dem. Rep. Congo",
  "England":                            "United Kingdom",
  "Republic of the Congo":              "Congo",
  "Czech Republic":                     "Czechia",
  "Guinea Bissau":                      "Guinea-Bissau",
  "Macedonia":                          "North Macedonia",
  "Republic of Serbia":                 "Serbia",
  "Swaziland":                          "eSwatini",
  "East Timor":                         "Timor-Leste",
  "United Republic of Tanzania":        "Tanzania",
  "USA":                                "United States of America"
};

//slide 1

let globalDataState = { averageTemperature: null };

async function slideOneMap() {
  d3.select("#map").html("");
  await ensureBaseData();
  initMapOne();
  updateMapOne(currentYear);

  const slider = document.getElementById("year-slider");
  const label  = document.getElementById("year-label");
  if (slider && label) {
    label.textContent = currentYear;
    slider.value = currentYear;
    slider.oninput = e => {
      currentYear = +e.target.value;
      label.textContent = currentYear;
      updateMapOne(currentYear);
    };
  }
}

function initMapOne() {
  d3.select("#map svg").remove();
  const mapEl = document.getElementById("map");
  const w = mapEl.clientWidth  || 680;
  const h = mapEl.clientHeight || 460;

  const svg = d3.select("#map").append("svg")
    .attr("viewBox", `0 0 ${w} ${h}`)
    .attr("width", "100%").attr("height", "100%");

  const proj = d3.geoNaturalEarth1()
    .scale(w / 5.2)
    .translate([w / 2, h / 2]);

  svg.append("path")
    .datum(geoDataGlobal)
    .attr("class", "global-landmass")
    .attr("d", d3.geoPath(proj))
    .attr("stroke", "none")
    .attr("fill", "rgba(255,255,255,0.06)")
    .on("mousemove", event => {
      const t = globalDataState.averageTemperature;
      const readout = document.getElementById("globe-temp-readout");
      if (readout) readout.textContent = t != null
        ? `Global anomaly vs 1850: ${t >= 0 ? "+" : ""}${t.toFixed(2)} °C`
        : "No data for this year";
      showTip(event, `<strong>Global Average</strong><br>${t != null ? (t >= 0 ? "+" : "") + t.toFixed(2) + " °C vs 1850" : "No data"}`);
    })
    .on("mouseleave", hideTip);
}

function updateMapOne(year) {
  const yearData   = climateDataGlobal.filter(d => +d.year === year);
  const validTemps = yearData.map(d => +d.mean_temp).filter(t => !isNaN(t));
  const avg        = validTemps.length ? d3.mean(validTemps) : null;

  const base1850   = climateDataGlobal.filter(d => +d.year === 1850);
  const baseTemps  = base1850.map(d => +d.mean_temp).filter(t => !isNaN(t));
  const baseAvg    = baseTemps.length ? d3.mean(baseTemps) : null;

  const anomaly = (avg != null && baseAvg != null) ? avg - baseAvg : null;

  globalDataState.averageTemperature = anomaly;
  const color = anomalyColor(-1, 0, 3);
  d3.select("#map svg .global-landmass")
    .transition().duration(120)
    .attr("fill", anomaly == null ? "rgba(255,255,255,0.06)" : color(anomaly));
}

//slide 2

async function slideTwoChart() {
  d3.select("#chart").html("");

  if (!historicalData) {
    const rows = await d3.csv("data/yearly_global_temp_historical.csv");
    historicalData = aggregateByYear(rows);
  }
  if (!projectedData) {
    const rows = await d3.csv("data/yearly_global_temp_ssp245.csv");
    projectedData = aggregateByYear(rows);
  }

  const baseline1850 = historicalData.find(d => d.year === 1850)?.temp;
  const baseline = baseline1850 ?? historicalData[0].temp;

  historicalData.forEach(d => { d.type = "historical"; d.anomaly = d.temp - baseline; });
  projectedData.forEach(d  => { d.type = "projected";  d.anomaly = d.temp - baseline; });

  const subhead = document.querySelector(".chart-subhead");
  if (subhead) subhead.textContent = "Plotted as warming since 1850 — the global aggregate, reframed.";
  const btnProject = document.getElementById("btn-project");
  if (btnProject) btnProject.textContent = "+ Show Projected (SSP2-4.5)";

  const margin = { top: 16, right: 24, bottom: 38, left: 64 };
  const totalW = 900, totalH = 340;
  const W = totalW - margin.left - margin.right;
  const H = totalH - margin.top  - margin.bottom;

  const svg = d3.select("#chart").append("svg")
    .attr("viewBox", `0 0 ${totalW} ${totalH}`)
    .attr("width", "100%")
    .style("overflow", "visible");
  svg.append("defs").append("clipPath")
    .attr("id", "plot-clip")
    .append("rect")
    .attr("x", 0).attr("y", 0)
    .attr("width", W).attr("height", H);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  let allData = [...historicalData];

  const x = d3.scaleLinear()
    .domain(d3.extent(allData, d => d.year))
    .range([0, W]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(allData, d => d.anomaly) + 0.15])
    .range([H, 0]);

  const gridG  = g.append("g").attr("class", "grid");
  const xAxisG = g.append("g").attr("class", "axis").attr("transform", `translate(0,${H})`);
  const yAxisG = g.append("g").attr("class", "axis");

  function updateGrid(yScale) {
    gridG.call(d3.axisLeft(yScale).tickSize(-W).tickFormat(""))
      .selectAll("line").attr("stroke", "rgba(255,255,255,0.06)");
    gridG.select(".domain").remove();
  }
  function styleAxes() {
    xAxisG.selectAll("line, path").attr("stroke", "rgba(255,255,255,0.15)");
    yAxisG.selectAll("line, path").attr("stroke", "rgba(255,255,255,0.15)");
    xAxisG.selectAll("text").attr("fill", "#7a7870");
    yAxisG.selectAll("text").attr("fill", "#7a7870");
  }
  function renderAxes() {
    xAxisG.call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")));
    yAxisG.call(d3.axisLeft(y).ticks(6).tickFormat(d => `+${d.toFixed(1)}°C`));
    styleAxes();
  }

  updateGrid(y);
  renderAxes();

  g.append("text")
    .attr("transform", "rotate(-90)").attr("y", -52).attr("x", -H / 2)
    .attr("text-anchor", "middle").attr("fill", "#7a7870").style("font-size", "10px")
    .text("Warming since 1850 (°C)");

  const lineGen = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.anomaly))
    .curve(d3.curveCatmullRom.alpha(0.5));

  const areaGen = d3.area()
    .x(d => x(d.year))
    .y0(H)
    .y1(d => y(d.anomaly))
    .curve(d3.curveCatmullRom.alpha(0.5));

  const plotG = g.append("g").attr("clip-path", "url(#plot-clip)");

  function animateLine(pathEl, durationMs) {
    const len = pathEl.node().getTotalLength();
    pathEl
      .attr("stroke-dasharray", `${len} ${len}`)
      .attr("stroke-dashoffset", len)
      .transition()
        .duration(durationMs)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0);
  }

  const bisect = d3.bisector(d => d.year).left;

  const hoverLine = g.append("line")
    .attr("class", "hover-rule")
    .attr("y1", 0).attr("y2", H)
    .attr("stroke", "rgba(255,255,255,0.18)")
    .attr("stroke-width", 1)
    .attr("pointer-events", "none")
    .style("display", "none");

  const hoverDot = g.append("circle")
    .attr("r", 4)
    .attr("fill", "#fff")
    .attr("pointer-events", "none")
    .style("display", "none");

  function attachTooltip(dataset) {
    let overlay = g.select(".tooltip-overlay");
    if (overlay.empty()) {
      overlay = g.append("rect").attr("class", "tooltip-overlay");
    }
    overlay
      .attr("width", W).attr("height", H)
      .attr("fill", "none")
      .attr("pointer-events", "all")
      .on("mousemove", function (event) {
        const [mx] = d3.pointer(event);
        const yr   = x.invert(mx);
        const i    = bisect(dataset, yr, 1);
        const d0   = dataset[i - 1], d1 = dataset[i];
        const d    = !d1 ? d0 : !d0 ? d1 : (yr - d0.year < d1.year - yr ? d0 : d1);
        if (!d) return;

        const cx = x(d.year), cy = y(d.anomaly);
        hoverLine.style("display", null).attr("x1", cx).attr("x2", cx);
        hoverDot.style("display", null).attr("cx", cx).attr("cy", cy);
        showTip(event, `<strong>${d.year}</strong>&nbsp;+${d.anomaly.toFixed(2)} °C since 1850`);
      })
      .on("mouseleave", () => {
        hoverLine.style("display", "none");
        hoverDot.style("display", "none");
        hideTip();
      });
  }

  plotG.append("path")
    .datum(historicalData)
    .attr("class", "area-hist")
    .attr("fill", "#4a90c4")
    .attr("fill-opacity", 0.15)
    .attr("d", areaGen);

  const histLine = plotG.append("path")
    .datum(historicalData)
    .attr("class", "line-hist")
    .attr("fill", "none")
    .attr("stroke", "#4a90c4")
    .attr("stroke-width", 2.2)
    .attr("d", lineGen);

  animateLine(histLine, 1400);
  attachTooltip(historicalData);

  document.getElementById("btn-project").addEventListener("click", function () {
    this.disabled = true;
    document.getElementById("btn-reset").disabled = false;
    document.getElementById("legend-proj").style.display = "inline";

    allData = [...historicalData, ...projectedData];
    x.domain(d3.extent(allData, d => d.year));
    y.domain([0, d3.max(allData, d => d.anomaly) + 0.15]);

    // Transition axes
    xAxisG.transition().duration(500).call(d3.axisBottom(x).ticks(10).tickFormat(d3.format("d")));
    yAxisG.transition().duration(500).call(d3.axisLeft(y).ticks(6).tickFormat(d => `+${d.toFixed(1)}°C`));
    styleAxes();
    updateGrid(y);

    // Morph historical paths to new scale
    plotG.select(".area-hist").transition().duration(500).attr("d", areaGen(historicalData));
    plotG.select(".line-hist").transition().duration(500).attr("d", lineGen(historicalData));

    // Draw projected area (fade in)
    plotG.append("path")
      .datum(projectedData)
      .attr("class", "area-proj")
      .attr("fill", "#c0392b")
      .attr("fill-opacity", 0)
      .attr("d", areaGen)
      .transition().delay(400).duration(700)
      .attr("fill-opacity", 0.18);

    // Draw projected line (animate on after a short delay)
    const projLine = plotG.append("path")
      .datum(projectedData)
      .attr("class", "line-proj")
      .attr("fill", "none")
      .attr("stroke", "#c0392b")
      .attr("stroke-width", 2.2)
      .attr("stroke-opacity", 0)
      .attr("d", lineGen);

    setTimeout(() => {
      const len = projLine.node().getTotalLength();
      projLine
        .attr("stroke-opacity", 1)
        .attr("stroke-dasharray", `${len} ${len}`)
        .attr("stroke-dashoffset", len)
        .transition()
          .duration(1200)
          .ease(d3.easeLinear)
          .attr("stroke-dashoffset", 0);
    }, 420);

    const markerX = x(2015);

    //2015 line
    const markerLine = g.append("line")
      .attr("class", "proj-marker")
      .attr("x1", markerX).attr("x2", markerX)
      .attr("y1", 0).attr("y2", H)
      .attr("stroke", "rgba(255,255,255,0.3)")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4 3")
      .attr("opacity", 0);

    const markerLabel = g.append("text")
      .attr("class", "proj-marker")
      .attr("x", markerX + 8)
      .attr("y", 16)
      .attr("fill", "rgba(255,255,255,0.45)")
      .attr("font-size", "7px")
      .attr("font-family", "var(--font-ui, sans-serif)")
      .text("projected temperatures")
      .attr("opacity", 0);

    setTimeout(() => {
      markerLine.transition().duration(400).attr("opacity", 1);
      markerLabel.transition().duration(400).attr("opacity", 1);
    }, 420);

    attachTooltip(allData);
  });

  document.getElementById("btn-reset").addEventListener("click", function () {
    this.disabled = true;
    document.getElementById("btn-project").disabled = false;
    document.getElementById("legend-proj").style.display = "none";

    // Fade out + remove projected layers
    plotG.select(".area-proj").transition().duration(300).attr("fill-opacity", 0).remove();
    plotG.select(".line-proj").transition().duration(300).attr("stroke-opacity", 0).remove();
    g.selectAll(".proj-marker").transition().duration(300).attr("opacity", 0).remove();

    setTimeout(() => {
      allData = [...historicalData];
      x.domain(d3.extent(allData, d => d.year));
      y.domain([0, d3.max(allData, d => d.anomaly) + 0.15]);

      xAxisG.transition().duration(500).call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")));
      yAxisG.transition().duration(400).call(d3.axisLeft(y).ticks(6).tickFormat(d => `+${d.toFixed(1)}°C`));
      styleAxes();
      updateGrid(y);

      // Morph historical paths back
      plotG.select(".area-hist").transition().duration(500).attr("d", areaGen(historicalData));
      plotG.select(".line-hist").transition().duration(500).attr("d", lineGen(historicalData));

      attachTooltip(historicalData);
    }, 320);
  });
}

// Slide 3

async function slideThreeMap() {
  d3.select("#map").html("");
  await ensureBaseData();
  createMapThree(currentYear);

  const slider = document.getElementById("year-slider");
  const label  = document.getElementById("year-label");
  label.textContent = currentYear;
  slider.value = currentYear;
  slider.addEventListener("input", e => {
    currentYear = +e.target.value;
    label.textContent = currentYear;
    createMapThree(currentYear);
  });
}

function createMapThree(year) {
  const yearData = climateDataGlobal.filter(d => +d.year === year);
  const tempMap  = new Map(yearData.map(d => [d.country, +d.mean_temp]));

  const base1850 = climateDataGlobal.filter(d => +d.year === 1850);
  const baseMap  = new Map(base1850.map(d => [d.country, +d.mean_temp]));

  geoDataGlobal.features.forEach(f => {
    const name = nameFixes[f.properties.name] ?? f.properties.name;
    const curr = tempMap.get(name) ?? null;
    const base = baseMap.get(name)  ?? null;
    f.properties.temperature = (curr != null && base != null) ? curr - base : null;
  });
  renderMapThree();
}

function renderMapThree() {
  d3.select("#map svg").remove();
  const mapEl  = document.getElementById("map");
  const width  = mapEl.clientWidth  || 680;
  const height = mapEl.clientHeight || 460;

  const svg = d3.select("#map").append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%").attr("height", "100%");

  const projection = d3.geoNaturalEarth1().scale(width / 5.6).translate([width / 2, height / 2]);
  const path  = d3.geoPath(projection);
  const color = anomalyColor(-1, 0, 3);  // ← diverging anomaly scale

  svg.selectAll("path")
    .data(geoDataGlobal.features)
    .join("path")
    .attr("d", path)
    .attr("fill", d => d.properties.temperature == null
      ? "rgba(255,255,255,0.06)"
      : color(d.properties.temperature))
    .attr("stroke", "rgba(255,255,255,0.15)").attr("stroke-width", 0.4)
    .on("mousemove", (event, d) => {
      const t = d.properties.temperature;
      showTip(event,
        `<strong>${d.properties.name}</strong><br>` +
        (t != null ? `${t >= 0 ? "+" : ""}${t.toFixed(2)} °C vs 1850` : "No data")
      );
    })
    .on("mouseleave", hideTip);

  // Update colorbar labels
  const spans = document.querySelectorAll(".colorbar-wrap span");
  if (spans.length >= 2) { spans[0].textContent = "−1°C"; spans[1].textContent = "+3°C"; }
  const cb = document.querySelector(".colorbar-wrap .colorbar");
  if (cb) cb.style.background = "linear-gradient(to right, #2166ac, #f7f7f7, #d73027)";
}

// Slide 4

async function slideFourUS() {
  await ensureBaseData();
  d3.select("#us-map").html("");

  const year    = 1850;
  const usTemp  = getCountryAnnualTemp(year, "USA", "United States of America");
  const glbTemp = getGlobalAvg(year);

  setText("global-temp-readout", glbTemp, "°C");
  setText("us-temp-readout",     usTemp,  "°C");

  annotateGeoWithYear(year);
  buildZoomedUSMap("#us-map", false);
}

//slide 5

async function slideFiveUS() {
  await ensureBaseData();
  d3.select("#us-map-5").html("");

  const year1 = 2014, year0 = 1850;
  const usTemp  = getCountryAnnualTemp(year1, "USA", "United States of America");
  const glbTemp = getGlobalAvg(year1);
  const usTemp0 = getCountryAnnualTemp(year0, "USA", "United States of America");
  const glbTemp0 = getGlobalAvg(year0);

  setText("global-temp-readout-5", glbTemp, "°C");
  setText("us-temp-readout-5",     usTemp,  "°C");

  const elDelta = document.getElementById("delta-readout");
  if (elDelta && usTemp && usTemp0 && glbTemp && glbTemp0) {
    const diff = (usTemp - usTemp0) - (glbTemp - glbTemp0);
    const sign = diff >= 0 ? "+" : "";
    elDelta.textContent = `${sign}${diff.toFixed(2)}°C`;
    elDelta.style.color = diff >= 0 ? "var(--red)" : "var(--accent2)";
  }

  annotateGeoWithYear(year1);
  buildLockedUSMap("#us-map-5", true);
}

// slide 9

async function slideNineUSSummer() {
  await ensureBaseData();
  d3.select("#us-map-9").html("");

  const [histRows, projRows] = await Promise.all([
    ensureSeasonalData("us", "historical"),
    ensureSeasonalData("us", "ssp245"),
  ]);

  const summer0  = lookupSeasonalTemp(histRows, 1850, "summer");
  const projYears = [...new Set(projRows.filter(r => r.season === "summer").map(r => +r.year))].sort((a,b) => b-a);
  const latestYr  = projYears[0] || 2100;
  const summerN   = lookupSeasonalTemp(projRows, latestYr, "summer");

  setText("us-summer-1850",  summer0, "°C");
  setText("us-summer-latest", summerN, `°C (${latestYr})`);

  const elDelta = document.getElementById("us-summer-delta");
  if (elDelta && summer0 != null && summerN != null) {
    const d = summerN - summer0;
    elDelta.textContent = `+${d.toFixed(2)}°C`;
  }

  await paintUSSeasonMapLocked("#us-map-9", "summer", "historical", 2014);
}

// used by slide 8 map

async function paintUSSeasonMap(containerSelector, season, scenario, year) {
  const rows = await ensureSeasonalData("country", scenario);
  const tempMap = buildSeasonalTempMap(rows, year, season);
 
  geoDataGlobal.features.forEach(f => {
    const name = nameFixes[f.properties.name] ?? f.properties.name;
    f.properties.temperature = tempMap.get(name) ?? null;
  });
 
  const container = document.querySelector(containerSelector);
  if (!container) return;
 
  const width  = container.clientWidth  || 700;
  const height = container.clientHeight || 500;
 
  const color = season === "winter"
    ? d3.scaleQuantize().domain([-15, 20]).range(d3.quantize(d3.interpolateBlues, 6))
    : d3.scaleQuantize().domain([5, 40]).range(d3.quantize(d3.interpolateOrRd, 6));
 
  const svg = d3.select(containerSelector).append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%").attr("height", "100%");
 
  const projection = d3.geoNaturalEarth1()
    .scale(width / 5.2)
    .translate([width / 2, height / 2]);
  const path = d3.geoPath(projection);
 
  // Same optimization: <g> + transform animation
  const mapGroup = svg.append("g");
 
  const countries = mapGroup.selectAll("path")
    .data(geoDataGlobal.features)
    .join("path")
    .attr("d", path)
    .attr("vector-effect", "non-scaling-stroke")
    .attr("fill", f => f.properties.temperature == null
      ? "rgba(255,255,255,0.06)"
      : color(f.properties.temperature))
    .attr("stroke", "#222").attr("stroke-width", 0.4).attr("opacity", 0.7)
    .on("mousemove", (event, f) => {
      const t = f.properties.temperature;
      const lbl = season === "winter" ? "Winter" : "Summer";
      showTip(event, `<strong>${f.properties.name}</strong>${t != null ? `${lbl}: ${t.toFixed(1)} °C` : "No data"}`);
    })
    .on("mouseleave", hideTip);
 
  const usFeature = geoDataGlobal.features.find(
    f => f.properties.name === "USA" || f.properties.name === "United States of America"
  );
  if (!usFeature) return;
 
  const targetProj = d3.geoNaturalEarth1();
  targetProj.fitSize([width * 0.85, height * 0.85], usFeature);
 
  const s  = targetProj.scale() / projection.scale();
  const tx = targetProj.translate()[0] - s * projection.translate()[0];
  const ty = targetProj.translate()[1] - s * projection.translate()[1];
 
  mapGroup.transition().duration(2000).ease(d3.easeCubicInOut)
    .attr("transform", `translate(${tx},${ty}) scale(${s})`);
 
  countries.transition().delay(1600).duration(700)
    .attr("opacity",      f => isUS(f) ? 1 : 0.06)
    .attr("stroke",       f => isUS(f) ? "white" : "#222")
    .attr("stroke-width", f => isUS(f) ? 1.5 : 0.3);
}

// used by slide 9 to keep zoomed on the US

async function paintUSSeasonMapLocked(containerSelector, season, scenario, year) {
  const rows = await ensureSeasonalData("country", scenario);
  const tempMap = buildSeasonalTempMap(rows, year, season);

  geoDataGlobal.features.forEach(f => {
    const name = nameFixes[f.properties.name] ?? f.properties.name;
    f.properties.temperature = tempMap.get(name) ?? null;
  });

  const container = document.querySelector(containerSelector);
  if (!container) return;

  const width  = container.clientWidth  || 700;
  const height = container.clientHeight || 500;

  const color = season === "winter"
    ? d3.scaleQuantize().domain([-15, 20]).range(d3.quantize(d3.interpolateBlues, 6))
    : d3.scaleQuantize().domain([5, 40]).range(d3.quantize(d3.interpolateOrRd, 6));

  const usFeature = geoDataGlobal.features.find(isUS);
  if (!usFeature) return;

  // Start projection already fitted to the US — no zoom animation
  const projection = d3.geoNaturalEarth1();
  projection.fitSize([width * 0.85, height * 0.85], usFeature);
  // Centre it nicely
  projection.translate([
    projection.translate()[0] + width  * 0.075,
    projection.translate()[1] + height * 0.075,
  ]);

  const path = d3.geoPath(projection);

  const svg = d3.select(containerSelector).append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%").attr("height", "100%");

  svg.selectAll("path")
    .data(geoDataGlobal.features)
    .join("path")
    .attr("d", path)
    .attr("fill", f => {
      if (!isUS(f)) return "rgba(255,255,255,0.04)";
      return f.properties.temperature == null
        ? "rgba(255,255,255,0.06)"
        : color(f.properties.temperature);
    })
    .attr("stroke",       f => isUS(f) ? "rgba(255,255,255,0.7)" : "#222")
    .attr("stroke-width", f => isUS(f) ? 1.5 : 0.3)
    .attr("opacity",      f => isUS(f) ? 0 : 0.04)
    .on("mousemove", (event, f) => {
      if (!isUS(f)) return;
      const t = f.properties.temperature;
      const lbl = season === "winter" ? "Winter" : "Summer";
      showTip(event, `<strong>${f.properties.name}</strong>${t != null ? `${lbl}: ${t.toFixed(1)} °C` : "No data"}`);
    })
    .on("mouseleave", hideTip)
    // Fade the US in
    .filter(isUS)
    .transition().duration(800)
    .attr("opacity", 1);
}

// used by slide 5 to stay on zoomed map 

function buildLockedUSMap(containerSelector, highlight) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  const width  = container.clientWidth  || 700;
  const height = container.clientHeight || 500;
  const color  = d3.scaleQuantize().domain([0, 30]).range(d3.quantize(d3.interpolateReds, 6));

  const usFeature = geoDataGlobal.features.find(isUS);
  if (!usFeature) return;

  // Fit projection directly to US — no pan animation
  const projection = d3.geoNaturalEarth1();
  projection.fitSize([width * 0.85, height * 0.85], usFeature);
  projection.translate([
    projection.translate()[0] + width  * 0.075,
    projection.translate()[1] + height * 0.075,
  ]);

  const path = d3.geoPath(projection);

  const svg = d3.select(containerSelector).append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%").attr("height", "100%");

  // Faded world context
  svg.selectAll("path.bg-country")
    .data(geoDataGlobal.features.filter(f => !isUS(f)))
    .join("path")
    .attr("class", "bg-country")
    .attr("d", path)
    .attr("fill", f => f.properties.temperature == null ? "#1a1a1a" : color(f.properties.temperature))
    .attr("stroke", "#111").attr("stroke-width", 0.3)
    .attr("opacity", 0.06);

  // US — highlighted
  svg.append("path")
    .datum(usFeature)
    .attr("d", path)
    .attr("fill", highlight ? "var(--red)" : (f => {
      const t = usFeature.properties.temperature;
      return t != null ? color(t) : "var(--accent)";
    }))
    .attr("stroke", "rgba(255,255,255,0.6)")
    .attr("stroke-width", 1.8)
    .attr("opacity", 0)
    .on("mousemove", event => {
      const t = usFeature.properties.temperature;
      showTip(event, `<strong>United States</strong>${t != null ? t.toFixed(1) + " °C" : "No data"}`);
    })
    .on("mouseleave", hideTip)
    .transition().delay(100).duration(700)
    .attr("opacity", 1);
}

// Slide 7

let slide7Season = "winter";
let slide7Year   = 1851;
let slide10Year   = 1851;
let slide10Season = "winter";
let slide10Level  = "us"; // This is temporarly for later additions, specifically for more detailed level
let slide10Selected = null;  // { name, level } when a state/country is clicked

async function slideSevenWorld() {
  const slider7 = document.getElementById("year-slider-7");
  const label7  = document.getElementById("year-label-7");
  if (slider7 && label7) { slider7.value = slide7Year; label7.textContent = slide7Year; }

  await ensureBaseData();
  d3.select("#map-7").html("");

  await Promise.all([
    ensureSeasonalData("country", "historical"),
    ensureSeasonalData("global",  "historical"),
  ]);

  renderSeasonWorldMap();

  if (slider7 && label7) {
    slider7.oninput = e => {
      slide7Year = +e.target.value;
      label7.textContent = slide7Year;
      renderSeasonWorldMap();
    };
  }

  document.getElementById("btn-winter").addEventListener("click", () => {
    slide7Season = "winter";
    document.getElementById("btn-winter").classList.add("active");
    document.getElementById("btn-summer").classList.remove("active");
    updateColorbarLabel();
    renderSeasonWorldMap();
  });
  document.getElementById("btn-summer").addEventListener("click", () => {
    slide7Season = "summer";
    document.getElementById("btn-summer").classList.add("active");
    document.getElementById("btn-winter").classList.remove("active");
    updateColorbarLabel();
    renderSeasonWorldMap();
  });
}

function updateColorbarLabel() {
  const cb = document.getElementById("colorbar-7");
  const lo = document.getElementById("colorbar-low-label");
  const hi = document.getElementById("colorbar-high-label");
  if (!cb) return;

  cb.style.background = "linear-gradient(to right, #2166ac, #f7f7f7, #d73027)";
  if (lo) lo.textContent = "−2°C";
  if (hi) hi.textContent = "+5°C";
}

function renderSeasonWorldMap() {
  d3.select("#map-7 svg").remove();

  const rows    = seasonalCache.historical.country || [];
  const tempMap = buildSeasonalTempMap(rows, slide7Year,  slide7Season);
  const baseMap = buildSeasonalTempMap(rows, 1850,        slide7Season);  // ← baseline

  geoDataGlobal.features.forEach(f => {
    const name = nameFixes[f.properties.name] ?? f.properties.name;
    const curr = tempMap.get(name) ?? null;
    const base = baseMap.get(name)  ?? null;
    f.properties.seasonTemp = (curr != null && base != null) ? curr - base : null;
  });

  const mapEl  = document.getElementById("map-7");
  const width  = mapEl.clientWidth  || 680;
  const height = mapEl.clientHeight || 460;

  const svg = d3.select("#map-7").append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%").attr("height", "100%");

  const projection = d3.geoNaturalEarth1().scale(width / 5.2).translate([width / 2, height / 2]);
  const path  = d3.geoPath(projection);
  const color = anomalyColor(-2, 0, 5);  // ← seasonal anomaly scale

  svg.selectAll("path")
    .data(geoDataGlobal.features)
    .join("path")
    .attr("d", path)
    .attr("fill", f => f.properties.seasonTemp == null
      ? "rgba(255,255,255,0.06)"
      : color(f.properties.seasonTemp))
    .attr("stroke", "rgba(255,255,255,0.15)").attr("stroke-width", 0.4)
    .on("mousemove", (event, f) => {
      const t = f.properties.seasonTemp;
      const label = slide7Season === "winter" ? "Winter" : "Summer";
      showTip(event,
        `<strong>${f.properties.name}</strong><br>` +
        (t != null ? `${label}: ${t >= 0 ? "+" : ""}${t.toFixed(2)} °C vs 1850` : "No data")
      );
    })
    .on("mouseleave", hideTip);

  updateColorbarLabel();
}

// Slide 8

async function slideEightUSWinter() {
  await ensureBaseData();
  d3.select("#us-map-8").html("");

  const [histRows, projRows] = await Promise.all([
    ensureSeasonalData("us", "historical"),
    ensureSeasonalData("us", "ssp245"),
  ]);

  const allRows   = [...histRows, ...projRows];
  const winter0   = lookupSeasonalTemp(histRows, 1850, "winter");
  // Latest projected year
  const projYears = [...new Set(projRows.filter(r => r.season === "winter").map(r => +r.year))].sort((a,b) => b-a);
  const latestYr  = projYears[0] || 2100;
  const winterN   = lookupSeasonalTemp(projRows, latestYr, "winter");

  setText("us-winter-1850",  winter0, "°C");
  setText("us-winter-latest", winterN, `°C (${latestYr})`);

  const elDelta = document.getElementById("us-winter-delta");
  if (elDelta && winter0 != null && winterN != null) {
    const d = winterN - winter0;
    elDelta.textContent = `+${d.toFixed(2)}°C`;
  }
  await paintUSSeasonMap("#us-map-8", "winter", "historical", 2014);
}

// Slide 10

const slide10StateCache = { historical: null, ssp245: null };
   async function loadStateRows(scenario) {
     if (!slide10StateCache[scenario]) {
       slide10StateCache[scenario] = await d3.csv(`data/seasonal_us_states_${scenario}.csv`);
     }
     return slide10StateCache[scenario];
   }

async function slideTenUSStates() {
  d3.select("#us-map-10-map").html("");
  hideDetailChart();
  _s10InvalidateLevel();   // entering the slide fresh — force SVG rebuild
  await ensureBaseData();

  const [histCountry, projCountry, histState, projState] = await Promise.all([
    ensureSeasonalData("country", "historical"),
    ensureSeasonalData("country", "ssp245"),
    loadStateRows("historical"),
    loadStateRows("ssp245"),
  ]);

  const histYears = [...new Set(histCountry.map(r => +r.year))].sort((a, b) => a - b);
  const projYears = [...new Set(projCountry.map(r => +r.year))].sort((a, b) => a - b);
  const minYear   = histYears[0];
  const maxYear   = projYears[projYears.length - 1] || histYears[histYears.length - 1];
  const histMax   = histYears[histYears.length - 1];

  // Expose a re-render hook so click handlers in renderers can re-render
  // the map to update the selection outline.
  window.__slide10ReRender = () =>
    renderSlide10Map(histCountry, projCountry, histState, projState, histMax);

  // slider
  const slider = document.getElementById("year-slider-10");
  const label  = document.getElementById("year-label-10");
  const src    = document.getElementById("year-source-10");
  if (slider) {
    slider.min   = minYear;
    slider.max   = maxYear-1;
    slider.value = slide10Year;
    if (label) label.textContent = slide10Year;
    if (src)   src.textContent = slide10Year > histMax ? "Projected (SSP2-4.5)" : "Historical (CMIP6)";
    slider.oninput = e => {
      slide10Year = +e.target.value;
      if (label) label.textContent = slide10Year;
      if (src)   src.textContent = slide10Year > histMax ? "Projected (SSP2-4.5)" : "Historical (CMIP6)";
      renderSlide10Map(histCountry, projCountry, histState, projState, histMax);
      updateChartYearMarker();    // cheap update — moves the vertical line only
    };
  }

  // season buttons
  const wBtn = document.getElementById("btn-10-winter");
  const sBtn = document.getElementById("btn-10-summer");
  const aBtn = document.getElementById("btn-10-annual");
  const setSeason = (val, btnOn) => {
    slide10Season = val;
    [wBtn, sBtn, aBtn].forEach(b => b?.classList.remove("active"));
    btnOn?.classList.add("active");
    renderSlide10Map(histCountry, projCountry, histState, projState, histMax);
    updateTradeoffHighlight();
    if (slide10Selected) renderSlide10DetailChart();
  };
  wBtn?.addEventListener("click", () => setSeason("winter", wBtn));
  sBtn?.addEventListener("click", () => setSeason("summer", sBtn));
  aBtn?.addEventListener("click", () => setSeason("annual", aBtn));

  // level buttons
  const usLvlBtn  = document.getElementById("btn-10-us");
  const ctrLvlBtn = document.getElementById("btn-10-countries");
  const glbLvlBtn = document.getElementById("btn-10-global");
  const setLevel = (val, btnOn) => {
    slide10Level = val;
    slide10Selected = null;       // changing level clears any current selection
    hideDetailChart();
    _s10InvalidateLevel();        // force SVG rebuild for the new level
    [usLvlBtn, ctrLvlBtn, glbLvlBtn].forEach(b => b?.classList.remove("active"));
    btnOn?.classList.add("active");
    renderSlide10Map(histCountry, projCountry, histState, projState, histMax);
    updateTradeoffHighlight();
  };
  usLvlBtn?.addEventListener("click",  () => setLevel("us",        usLvlBtn));
  ctrLvlBtn?.addEventListener("click", () => setLevel("countries", ctrLvlBtn));
  glbLvlBtn?.addEventListener("click", () => setLevel("global",    glbLvlBtn));

  renderSlide10Map(histCountry, projCountry, histState, projState, histMax);
  updateTradeoffHighlight();
}


// Highlights the tradeoff-row(s) matching the current level and season.
// Level and annual are independent — both can be active simultaneously.
function updateTradeoffHighlight() {
  document.querySelectorAll(".text-panel .tradeoff-row")
    .forEach(row => row.classList.remove("active-row"));

  // Level row: global → global, countries → country, us → state
  const levelTarget = slide10Level === "global" ? "global"
    : slide10Level === "countries" ? "country"
    : "state";
  const levelRow = document.querySelector(`.tradeoff-row[data-level="${levelTarget}"]`);
  if (levelRow) levelRow.classList.add("active-row");

  // Annual row: always highlight when annual season is selected
  if (slide10Season === "annual") {
    const annualRow = document.querySelector(`.tradeoff-row[data-level="annual"]`);
    if (annualRow) annualRow.classList.add("active-row");
  }
}
 
// Top-level render dispatcher — picks the right view for current level
async function renderSlide10Map(histCountry, projCountry, histState, projState, histMaxYear) {
  const isProjected = slide10Year > histMaxYear;
  const countryRows = isProjected ? projCountry : histCountry;
  const stateRows   = isProjected ? projState   : histState;
  const seasons     = slide10Season === "annual" ? ["winter", "summer"] : [slide10Season];

  // Helper: average a value across both seasons per key
  function buildAnnualMap(rows, year, keyField, valField) {
    const acc = new Map();
    seasons.forEach(s => {
      rows.filter(r => +r.year === year && r.season === s).forEach(r => {
        const key = r[keyField];
        const v   = +r[valField];
        if (!isNaN(v)) {
          const prev = acc.get(key) || { sum: 0, n: 0 };
          acc.set(key, { sum: prev.sum + v, n: prev.n + 1 });
        }
      });
    });
    return new Map([...acc].map(([k, { sum, n }]) => [k, sum / n]));
  }

  // Current year country temps
  const tempMap     = buildAnnualMap(countryRows, slide10Year, "country", "mean_temp");
  // 1850 baseline country temps
  const baseCountryMap = buildAnnualMap(histCountry, 1850, "country", "mean_temp");

  // Current year state temps
  const currStateMap = buildAnnualMap(stateRows, slide10Year, "state", "mean_temp_c");
  // 1850 baseline state temps
  const baseStateMap = buildAnnualMap(histState, 1850, "state", "mean_temp_c");

  // State diff: current − 1850
  const stateTempMap = new Map();
  currStateMap.forEach((curr, state) => {
    const base = baseStateMap.get(state);
    if (base != null) stateTempMap.set(state, curr - base);
  });

  // Annotate geo features with country diff
  geoDataGlobal.features.forEach(f => {
    const name = nameFixes[f.properties.name] ?? f.properties.name;
    const curr = tempMap.get(name) ?? null;
    const base = baseCountryMap.get(name) ?? null;
    f.properties.temperature = (curr != null && base != null) ? curr - base : null;
  });

  if (slide10Level === "us") {
    const usCountryDiff = (() => {
      const c = tempMap.get("United States of America");
      const b = baseCountryMap.get("United States of America");
      return c != null && b != null ? c - b : null;
    })();
    await renderSlide10US(usCountryDiff, stateTempMap);
  } else if (slide10Level === "countries") {
    renderSlide10Countries();
  } else if (slide10Level === "global") {
    const vals = seasons.flatMap(s =>
      (isProjected ? projCountry : histCountry)
        .filter(r => +r.year === slide10Year && r.season === s)
        .map(r => +r.mean_temp)
        .filter(v => !isNaN(v))
    );
    const avg = vals.length ? d3.mean(vals) : null;

    const baseVals = seasons.flatMap(s =>
      histCountry
        .filter(r => +r.year === 1850 && r.season === s)
        .map(r => +r.mean_temp)
        .filter(v => !isNaN(v))
    );
    const baseAvg = baseVals.length ? d3.mean(baseVals) : null;

    const anomaly = (avg != null && baseAvg != null) ? avg - baseAvg : null;
    renderSlide10Global(anomaly);
  }
}
 
// ---- Slide-10 renderer state ----
// Each renderer is split into init (build SVG once) + update (mutate fills/strokes).
// The SVG is only rebuilt when the level changes or the container has been cleared.

let _s10USStatesGeo   = null;   // cached us-states.geojson — never re-fetched
let _s10LastLevel     = null;   // tracks which level's SVG is currently in the container

// Invalidate the cached level so the next render call rebuilds from scratch.
// Call this when the slide is first entered or the level button is clicked.
function _s10InvalidateLevel() { _s10LastLevel = null; }

// renderer — US zoomed, state outlines on top
// Builds the SVG once; on re-calls just updates fills and selection strokes.
async function renderSlide10US(usTemp, stateTempMap) {
  const container = document.querySelector("#us-map-10-map");
  if (!container) return;

  const color = anomalyColor(-1, 0, 3);

  // ── INIT (first call for this level) ──────────────────────────────────────
  if (_s10LastLevel !== "us") {
    d3.select("#us-map-10-map svg").remove();
    _s10LastLevel = "us";

    const width  = container.clientWidth  || 700;
    const height = container.clientHeight || 280;

    const usFeature = geoDataGlobal.features.find(isUS);
    if (!usFeature) return;

    const projection = d3.geoNaturalEarth1();
    projection.fitSize([width * 0.9, height * 0.9], usFeature);
    projection.translate([
      projection.translate()[0] + width  * 0.05,
      projection.translate()[1] + height * 0.05,
    ]);
    const path = d3.geoPath(projection);

    const svg = d3.select("#us-map-10-map").append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%").attr("height", "100%");

    svg.selectAll(".country-bg")
      .data(geoDataGlobal.features)
      .join("path")
      .attr("class", "country-bg")
      .attr("d", path)
      .attr("fill", "#1a1a1a")
      .attr("stroke", "#111").attr("stroke-width", 0.3)
      .attr("opacity", f => isUS(f) ? 0 : 0.04);

    svg.append("path")
      .attr("class", "us-outline")
      .datum(usFeature)
      .attr("d", path)
      .attr("fill", "#2a2a2a")
      .attr("stroke", "rgba(255,255,255,0.25)").attr("stroke-width", 0.5);

    // Load states geojson once and cache it
    if (!_s10USStatesGeo) {
      try { _s10USStatesGeo = await d3.json("data/us-states.geojson"); }
      catch (e) { return; }
    }
    const statesGeo = _s10USStatesGeo;
    if (!statesGeo) return;

    svg.selectAll(".state")
      .data(statesGeo.features)
      .join("path")
      .attr("class", "state")
      .attr("d", path)
      .attr("cursor", "pointer")
      .attr("opacity", 0)
      .on("mousemove", (event, f) => {
        // Read fill data from the live stateTempMap closure in the UPDATE section below.
        // We re-attach this handler on every update so it always closes over the latest map.
      })
      .on("mouseleave", hideTip)
      .on("click", () => {})   // placeholder — wired in update
      .transition().duration(500).attr("opacity", 1);
  }

  // ── UPDATE (every call including the first, after init) ───────────────────
  const svg = d3.select("#us-map-10-map svg");
  if (svg.empty()) return;

  const isSelected = f =>
    slide10Selected && slide10Selected.level === "us" &&
    slide10Selected.name === f.properties.name;

  svg.selectAll(".state")
    .attr("fill", f => {
      const t = stateTempMap.get(f.properties.name);
      return t != null ? color(t) : "rgba(255,255,255,0.04)";
    })
    .attr("stroke", f => isSelected(f) ? "#ffffff" : "rgba(255,255,255,0.45)")
    .attr("stroke-width", f => isSelected(f) ? 2.2 : 0.7)
    .on("mousemove", (event, f) => {
      const t = stateTempMap.get(f.properties.name);
      const seasonLbl = slide10Season === "annual" ? "Annual avg"
        : slide10Season === "winter" ? "Winter" : "Summer";
      showTip(event,
        `<strong>${f.properties.name}</strong>` +
        (t != null
          ? `<br>${slide10Year} ${seasonLbl}: ${t >= 0 ? "+" : ""}${t.toFixed(1)} °C vs 1850<br><span style="opacity:0.6;font-size:0.7rem;">Click to see trajectory</span>`
          : `<br><span style="opacity:0.7;">No data for ${f.properties.name}</span>`)
      );
    })
    .on("click", (event, f) => {
      const name = f.properties.name;
      if (slide10Selected && slide10Selected.name === name && slide10Selected.level === "us") {
        slide10Selected = null;
        hideDetailChart();
      } else if (stateTempMap.get(name) != null) {
        slide10Selected = { name, level: "us" };
        renderSlide10DetailChart();
      }
      if (typeof __slide10ReRender === "function") __slide10ReRender();
    });
}


// renderer — single merged landmass colored by global seasonal average (mirrors slide 1)
function renderSlide10Global(avgTemp) {
  const container = document.querySelector("#us-map-10-map");
  if (!container) return;

  const color = anomalyColor(-1, 0, 3);

  // ── INIT ──────────────────────────────────────────────────────────────────
  if (_s10LastLevel !== "global") {
    d3.select("#us-map-10-map svg").remove();
    _s10LastLevel = "global";

    const width  = container.clientWidth  || 700;
    const height = container.clientHeight || 280;

    const proj = d3.geoNaturalEarth1()
      .scale(width / 5.2)
      .translate([width / 2, height / 2]);

    const svg = d3.select("#us-map-10-map").append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%").attr("height", "100%");

    svg.append("path")
      .attr("class", "global-landmass")
      .datum(geoDataGlobal)
      .attr("d", d3.geoPath(proj))
      .attr("stroke", "none");
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────
  d3.select("#us-map-10-map svg .global-landmass")
    .attr("fill", avgTemp == null ? "rgba(255,255,255,0.06)" : color(avgTemp))
    .on("mousemove", event => {
      showTip(event,
        `<strong>Global Average</strong><br>` +
        (avgTemp != null ? `${avgTemp >= 0 ? "+" : ""}${avgTemp.toFixed(2)} °C vs 1850` : "No data")
      );
    })
    .on("mouseleave", hideTip);
}

function renderSlide10Countries() {
  const container = document.querySelector("#us-map-10-map");
  if (!container) return;

  const color = anomalyColor(-1, 0, 3);

  // ── INIT ──────────────────────────────────────────────────────────────────
  if (_s10LastLevel !== "countries") {
    d3.select("#us-map-10-map svg").remove();
    _s10LastLevel = "countries";

    const width  = container.clientWidth  || 700;
    const height = container.clientHeight || 280;

    const projection = d3.geoNaturalEarth1().scale(width / 5.6).translate([width / 2, height / 2]);
    const path = d3.geoPath(projection);

    const svg = d3.select("#us-map-10-map").append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%").attr("height", "100%");

    svg.selectAll("path")
      .data(geoDataGlobal.features)
      .join("path")
      .attr("d", path)
      .attr("cursor", "pointer");
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────
  const svg = d3.select("#us-map-10-map svg");
  if (svg.empty()) return;

  const isSelected = f =>
    slide10Selected && slide10Selected.level === "countries" &&
    (f.properties.name === slide10Selected.name ||
     (nameFixes[f.properties.name] ?? f.properties.name) === slide10Selected.name);

  svg.selectAll("path")
    .attr("fill", f => f.properties.temperature == null
      ? "rgba(255,255,255,0.06)"
      : color(f.properties.temperature))
    .attr("stroke", f => isSelected(f) ? "#ffffff" : "rgba(255,255,255,0.15)")
    .attr("stroke-width", f => isSelected(f) ? 1.6 : 0.4)
    .on("mousemove", (event, f) => {
      const t = f.properties.temperature;
      showTip(event,
        `<strong>${f.properties.name}</strong><br>` +
        (t != null
          ? `${t >= 0 ? "+" : ""}${t.toFixed(2)} °C vs 1850<br><span style="opacity:0.6;font-size:0.7rem;">Click to see trajectory</span>`
          : "No data")
      );
    })
    .on("mouseleave", hideTip)
    .on("click", (event, f) => {
      const canonical = nameFixes[f.properties.name] ?? f.properties.name;
      if (slide10Selected && slide10Selected.name === canonical && slide10Selected.level === "countries") {
        slide10Selected = null;
        hideDetailChart();
      } else if (f.properties.temperature != null) {
        slide10Selected = { name: canonical, level: "countries" };
        renderSlide10DetailChart();
      }
      if (typeof __slide10ReRender === "function") __slide10ReRender();
    });
}


// NEW: pull a year-by-year temperature series for the selected entity
function getEntitySeries(rows, level, season, name) {
  // Returns: [{year, temp}, …] for the entity's seasonal time series.
  // For "annual", averages winter + summer per year.
  const colName = level === "us" ? "state" : "country";
  const tempCol = level === "us" ? "mean_temp_c" : "mean_temp";

  if (season === "annual") {
    const winter = rows.filter(r => r[colName] === name && r.season === "winter");
    const summer = rows.filter(r => r[colName] === name && r.season === "summer");
    const wMap = new Map(winter.map(r => [+r.year, +r[tempCol]]));
    const sMap = new Map(summer.map(r => [+r.year, +r[tempCol]]));
    const years = [...new Set([...wMap.keys(), ...sMap.keys()])].sort((a, b) => a - b);
    return years
      .map(y => {
        const w = wMap.get(y), s = sMap.get(y);
        if (w == null || s == null) return null;
        return { year: y, temp: (w + s) / 2 };
      })
      .filter(Boolean);
  }
  return rows
    .filter(r => r[colName] === name && r.season === season)
    .map(r => ({ year: +r.year, temp: +r[tempCol] }))
    .sort((a, b) => a.year - b.year);
}


// NEW: render the per-entity detail chart with global comparison
async function renderSlide10DetailChart() {
  const container = document.getElementById("us-map-10-chart");
  if (!container) return;
  if (!slide10Selected) { hideDetailChart(); return; }

  const { name, level } = slide10Selected;

  // load entity data
  let histRows, projRows;
  if (level === "us") {
    [histRows, projRows] = await Promise.all([loadStateRows("historical"), loadStateRows("ssp245")]);
  } else {
    [histRows, projRows] = await Promise.all([
      ensureSeasonalData("country", "historical"),
      ensureSeasonalData("country", "ssp245"),
    ]);
  }

  const seasonKey = slide10Season;
  const entityHist = getEntitySeries(histRows, level, seasonKey, name);
  const entityProj = getEntitySeries(projRows, level, seasonKey, name);

  if (!entityHist.length) {
    container.style.display = "block";
    d3.select("#us-map-10-chart svg").remove();
    d3.select("#us-map-10-chart .chart-error").remove();
    d3.select("#us-map-10-chart").append("div")
      .attr("class", "chart-error")
      .style("padding", "30px 12px")
      .style("color", "var(--muted)")
      .style("font-family", "var(--font-ui)")
      .style("font-size", "0.85rem")
      .text(`No ${seasonKey} data available for ${name}.`);
    return;
  }

  // load global comparison data
  const [gHist, gProj] = await Promise.all([
    ensureSeasonalData("global", "historical"),
    ensureSeasonalData("global", "ssp245"),
  ]);

  const globalSeries = (rows) => {
    if (seasonKey === "annual") {
      const w = rows.filter(r => r.season === "winter");
      const s = rows.filter(r => r.season === "summer");
      const wM = new Map(w.map(r => [+r.year, +r.mean_temp]));
      const sM = new Map(s.map(r => [+r.year, +r.mean_temp]));
      const yrs = [...new Set([...wM.keys(), ...sM.keys()])].sort((a, b) => a - b);
      return yrs.map(y => {
        const wv = wM.get(y), sv = sM.get(y);
        if (wv == null || sv == null) return null;
        return { year: y, temp: (wv + sv) / 2 };
      }).filter(Boolean);
    }
    return rows.filter(r => r.season === seasonKey)
      .map(r => ({ year: +r.year, temp: +r.mean_temp }))
      .sort((a, b) => a.year - b.year);
  };
  const globalHist = globalSeries(gHist);
  const globalProj = globalSeries(gProj);

  // compute anomalies vs 1850 for each series independently
  const baselineOf = arr => arr.find(d => d.year === 1850)?.temp ?? arr[0]?.temp ?? 0;
  const entBase = baselineOf(entityHist);
  const glbBase = baselineOf(globalHist);
  const eH = entityHist.map(d => ({ year: d.year, anomaly: d.temp - entBase }));
  const eP = entityProj.map(d => ({ year: d.year, anomaly: d.temp - entBase }));
  const gH = globalHist.map(d => ({ year: d.year, anomaly: d.temp - glbBase }));
  const gP = globalProj.map(d => ({ year: d.year, anomaly: d.temp - glbBase }));

  // ---- DRAW ----
  container.style.display = "block";
  d3.select("#us-map-10-chart svg").remove();
  d3.select("#us-map-10-chart .chart-error").remove();

  const W_total = container.clientWidth  || 700;
  const H_total = container.clientHeight || 200;
  const margin = { top: 24, right: 14, bottom: 22, left: 40 };
  const W = W_total - margin.left - margin.right;
  const H = H_total - margin.top  - margin.bottom;

  const svg = d3.select("#us-map-10-chart").append("svg")
    .attr("width", W_total).attr("height", H_total).style("display", "block");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const allPts = [...eH, ...eP, ...gH, ...gP];
  const x = d3.scaleLinear().domain(d3.extent(allPts, d => d.year)).range([0, W]);
  const yMin = Math.min(0, d3.min(allPts, d => d.anomaly) - 0.3);
  const yMax = d3.max(allPts, d => d.anomaly) + 0.3;
  const y = d3.scaleLinear().domain([yMin, yMax]).range([H, 0]);

  // zero baseline
  g.append("line")
    .attr("x1", 0).attr("x2", W)
    .attr("y1", y(0)).attr("y2", y(0))
    .attr("stroke", "rgba(255,255,255,0.18)")
    .attr("stroke-dasharray", "2 3");

  // 2014/2015 transition line
  const transitionX = x(2015);
  g.append("line")
    .attr("x1", transitionX).attr("x2", transitionX)
    .attr("y1", 0).attr("y2", H)
    .attr("stroke", "rgba(255,255,255,0.12)")
    .attr("stroke-dasharray", "3 3");

  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.anomaly))
    .curve(d3.curveCatmullRom.alpha(0.5));

  // global lines — dashed gray (background)
  g.append("path").datum(gH)
    .attr("fill", "none").attr("stroke", "#8a8780")
    .attr("stroke-width", 1.3).attr("stroke-dasharray", "4 3").attr("d", line);
  g.append("path").datum(gP)
    .attr("fill", "none").attr("stroke", "#8a8780")
    .attr("stroke-width", 1.3).attr("stroke-dasharray", "4 3").attr("opacity", 0.7).attr("d", line);

  // entity lines — solid (foreground)
  g.append("path").datum(eH)
    .attr("fill", "none").attr("stroke", "#4a90c4")
    .attr("stroke-width", 2.4).attr("d", line);
  g.append("path").datum(eP)
    .attr("fill", "none").attr("stroke", "#c0392b")
    .attr("stroke-width", 2.4).attr("d", line);

  // axes
  g.append("g")
    .attr("transform", `translate(0,${H})`)
    .call(d3.axisBottom(x).ticks(7).tickFormat(d3.format("d")))
    .call(s => s.selectAll("line, path").attr("stroke", "rgba(255,255,255,0.18)"))
    .call(s => s.selectAll("text").attr("fill", "var(--muted)").style("font-size", "10px"));
  g.append("g")
    .call(d3.axisLeft(y).ticks(4).tickFormat(d => `${d >= 0 ? "+" : ""}${d.toFixed(1)}°C`))
    .call(s => s.selectAll("line, path").attr("stroke", "rgba(255,255,255,0.18)"))
    .call(s => s.selectAll("text").attr("fill", "var(--muted)").style("font-size", "10px"));

  // year marker (updates separately on slider drag — has its own class so it's findable)
  g.append("line")
    .attr("class", "year-marker")
    .attr("x1", x(slide10Year)).attr("x2", x(slide10Year))
    .attr("y1", 0).attr("y2", H)
    .attr("stroke", "var(--accent)")
    .attr("stroke-width", 1.5).attr("opacity", 0.75);

  // title + stat
  const seasonLbl = seasonKey === "annual" ? "annual" : seasonKey;
  const finalEnt = (eP[eP.length - 1] ?? eH[eH.length - 1]).anomaly;
  const finalGlb = (gP[gP.length - 1] ?? gH[gH.length - 1]).anomaly;
  const diff = finalEnt - finalGlb;
  const sign = diff >= 0 ? "+" : "";

  g.append("text")
    .attr("x", 0).attr("y", -10)
    .attr("fill", "var(--text)")
    .style("font-size", "11px")
    .style("font-family", "var(--font-ui)")
    .style("font-weight", "500")
    .text(`${name} — ${seasonLbl} warming since 1850 (vs global)`);

  g.append("text")
    .attr("x", 0).attr("y", 4)
    .attr("fill", "var(--muted)")
    .style("font-size", "9.5px")
    .style("font-family", "var(--font-ui)")
    .text(
      `By 2100: ${name} ${finalEnt >= 0 ? "+" : ""}${finalEnt.toFixed(1)}°C   |   ` +
      `Global ${finalGlb >= 0 ? "+" : ""}${finalGlb.toFixed(1)}°C   |   ` +
      `Difference ${sign}${diff.toFixed(1)}°C`
    );

  // legend (top right)
  const legend = g.append("g").attr("transform", `translate(${W - 140}, -16)`);
  legend.append("line").attr("x1", 0).attr("x2", 14).attr("y1", 4).attr("y2", 4)
    .attr("stroke", "#4a90c4").attr("stroke-width", 2);
  legend.append("text").attr("x", 18).attr("y", 7)
    .attr("fill", "var(--muted)").style("font-size", "9px").text(name.length > 16 ? name.slice(0, 14) + "…" : name);
  legend.append("line").attr("x1", 70).attr("x2", 84).attr("y1", 4).attr("y2", 4)
    .attr("stroke", "#8a8780").attr("stroke-width", 1.3).attr("stroke-dasharray", "3 2");
  legend.append("text").attr("x", 88).attr("y", 7)
    .attr("fill", "var(--muted)").style("font-size", "9px").text("Global");

  // wire up close button
  const closeBtn = document.getElementById("us-map-10-chart-close");
  if (closeBtn) {
    closeBtn.onclick = () => {
      slide10Selected = null;
      hideDetailChart();
      if (typeof __slide10ReRender === "function") __slide10ReRender();
    };
  }
}

// NEW: efficient slider-drag year-marker update (no full re-render)
function updateChartYearMarker() {
  if (!slide10Selected) return;
  const marker = d3.select("#us-map-10-chart svg .year-marker");
  if (marker.empty()) return;
  // recompute x position from current scale
  const container = document.getElementById("us-map-10-chart");
  const W_total = container.clientWidth;
  const W = W_total - 40 - 14;     // matches the margins in renderSlide10DetailChart
  const xPos = 40 + (slide10Year - 1850) / (2100 - 1850) * W;
  marker.attr("x1", xPos - 40).attr("x2", xPos - 40);
}

// NEW: hide the chart panel
function hideDetailChart() {
  const container = document.getElementById("us-map-10-chart");
  if (!container) return;
  container.style.display = "none";
  d3.select("#us-map-10-chart svg").remove();
  d3.select("#us-map-10-chart .chart-error").remove();
}


//Helpers

function isUS(feature) {
  return feature.properties.name === "USA" || feature.properties.name === "United States of America";
}

function setText(id, val, suffix = "") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = val != null ? `${val.toFixed(1)}${suffix}` : "--";
}

/** Annotate geoDataGlobal features with annual mean_temp from climateDataGlobal for a given year. */
function annotateGeoWithYear(year) {
  const yearData = climateDataGlobal.filter(d => +d.year === year);
  const tempMap  = new Map(yearData.map(d => [d.country, +d.mean_temp]));
  geoDataGlobal.features.forEach(f => {
    const name = nameFixes[f.properties.name] ?? f.properties.name;
    f.properties.temperature = tempMap.get(name) ?? null;
  });
}

/** Build a zoomed-to-US world map with pan animation (used by slide 4). */
function buildZoomedUSMap(containerSelector, highlight) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
 
  const width  = container.clientWidth  || 700;
  const height = container.clientHeight || 500;
  const color  = d3.scaleQuantize().domain([0, 30]).range(d3.quantize(d3.interpolateReds, 6));
 
  const svg = d3.select(containerSelector).append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%").attr("height", "100%");
 
  const projection = d3.geoNaturalEarth1()
    .scale(width / 5.2)
    .translate([width / 2, height / 2]);
  const path = d3.geoPath(projection);
 
  // Wrap everything in a <g> so we can animate one transform
  // instead of re-projecting 177 paths every frame, otherwise laggy as hell
  const mapGroup = svg.append("g");
 
  const countries = mapGroup.selectAll("path")
    .data(geoDataGlobal.features)
    .join("path")
    .attr("d", path) // computed ONCE
    .attr("vector-effect", "non-scaling-stroke")  // keep stroke widths visually constant
    .attr("fill", f => f.properties.temperature == null
      ? "rgba(255,255,255,0.06)"
      : color(f.properties.temperature))
    .attr("stroke", "#222").attr("stroke-width", 0.4).attr("opacity", 0.6)
    .on("mousemove", (event, f) => {
      const t = f.properties.temperature;
      showTip(event, `<strong>${f.properties.name}</strong>${t != null ? t.toFixed(1) + " °C" : "No data"}`);
    })
    .on("mouseleave", hideTip);
 
  const usFeature = geoDataGlobal.features.find(isUS);
  if (!usFeature) return;
 
  // Target projection — US-fitted
  const targetProj = d3.geoNaturalEarth1();
  targetProj.fitSize([width * 0.85, height * 0.85], usFeature);
 
  // Convert "change projection scale/translate" → equivalent SVG transform
  const s  = targetProj.scale() / projection.scale();
  const tx = targetProj.translate()[0] - s * projection.translate()[0];
  const ty = targetProj.translate()[1] - s * projection.translate()[1];
 
  // Single transform animation — GPU-accelerated, no per-frame projection math
  mapGroup.transition().duration(2000).ease(d3.easeCubicInOut)
    .attr("transform", `translate(${tx},${ty}) scale(${s})`);
 
  // Post-zoom dim / highlight (same behavior as the original)
  if (highlight) {
    countries.transition().delay(1600).duration(700)
      .attr("opacity",      f => isUS(f) ? 1 : 0.08)
      .attr("fill",         f => isUS(f) ? "var(--red)" : "#333")
      .attr("stroke",       f => isUS(f) ? "white" : "#222")
      .attr("stroke-width", f => isUS(f) ? 1.5 : 0.4);
  } else {
    countries.transition().delay(1600).duration(700)
      .attr("opacity",      f => isUS(f) ? 1 : 0.15)
      .attr("stroke",       f => isUS(f) ? "white" : "#222")
      .attr("stroke-width", f => isUS(f) ? 1.5 : 0.4);
  }
}