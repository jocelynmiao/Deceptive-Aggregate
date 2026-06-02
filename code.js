let historicalData    = null;
let projectedData     = null;
let geoDataGlobal     = null;
let climateDataGlobal = null;

// Seasonal caches: { historical: { global, country, us }, ssp245: { ... } }
const seasonalCache = { historical: {}, ssp245: {} };

let currentYear  = 1900;
let currentSlide = 0;

const tooltip = d3.select("#d3-tooltip");

function showTip(event, html) {
  tooltip.style("display", "block")
    .style("left",  (event.clientX + 14) + "px")
    .style("top",   (event.clientY - 36) + "px")
    .html(html);
}
function hideTip() { tooltip.style("display", "none"); }

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
    label: "Introduction",
    content: `
      <div class="slide-layout">
        <div class="text-panel">
          <h3>Slide 01 — The Aggregate</h3>
          <h2>Average Global<br>Temperature</h2>
          <p>Climate change is often presented on a global scale ...</p>
          <div style="margin-top:20px;">
            <input id="year-slider" type="range" min="1850" max="2014" step="1" value="1900">
            <div class="year-display" id="year-label">1900</div>
          </div>
          <div id="globe-temp-readout" style="margin-top:16px;font-family:var(--font-ui);font-size:0.8rem;color:var(--muted);">
            Hover the map for the global average
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
        <button class="chart-btn" id="btn-project">+ Show Projected (SSP5-8.5)</button>
        <button class="chart-btn secondary" id="btn-reset" disabled>Reset to Historical</button>
      </div>
      <div id="chart"></div>
      <div id="legend">
        <span><span class="legend-swatch" style="background:#4a90c4"></span>Historical (CMIP6)</span>
        <span id="legend-proj" style="display:none">
          <span class="legend-swatch" style="background:#c0392b"></span>Projected SSP5-8.5
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
            <div class="year-display" id="year-label">1900</div>
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
          By isolating the country, it is clear the U.S. has warmed significantly. How does it compare globaly?
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
        <h1>But is this change<br><em>"enough"</em> for making<br>the data more relatable?</h1>
        <p class="lead">
          Zooming into a single country helps — but does it really connect with
          people's lived experience of climate change?
        </p>
        <div class="question-pills">
          <div class="q-pill">Country-level is more relatable than global…</div>
          <div class="q-pill">But annual averages hide seasonal data</div>
          <div class="q-pill">And national averages hide regional variation</div>
        </div>
        <p style="margin-top:28px;">
          What if we looked at the seasons people <em>actually experience</em> — like
          the winters that keep getting shorter, or summers that keep getting hotter?
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
            <div class="year-display" id="year-label-7">1900</div>
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
          <h3>Slide 10 — Conclusion</h3>
          <h2>What Are the<br>Tradeoffs?</h2>
          <p>
            Furthermore, looking at the state-level reveals even more information
            that pertains to specific audiences from each state.
          </p>
          <p>
            But what are the tradeoffs of these visualization decisions?
          </p>
          <div class="tradeoff-list">
            <div class="tradeoff-row active-row">
              <span class="tradeoff-icon"></span>
              <div><strong>Global scale</strong> — Fastest to interpret climate change broadly, but least personal.</div>
            </div>
            <div class="tradeoff-row">
              <span class="tradeoff-icon"></span>
              <div><strong>Country level</strong> — Easier to interpret; more relevant for general audiences.</div>
            </div>
            <div class="tradeoff-row">
              <span class="tradeoff-icon"></span>
              <div><strong>Annual averages</strong> — Simpler, but hides seasonal extremes people actually feel.</div>
            </div>
            <div class="tradeoff-row">
              <span class="tradeoff-icon"></span>
              <div><strong>State level</strong> — Highly relatable for U.S. audiences; requires aggregating specific information.</div>
            </div>
          </div>
          <p style="margin-top:20px;font-size:0.85rem;">
            <em>So — who is our audience, and how do we most efficiently convey our message?</em>
          </p>
        </div>
        <div id="us-map-10" style="flex:1;min-height:420px;"></div>
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

  const contentEl = document.getElementById("content");
  contentEl.classList.remove("visible");
  contentEl.style.transform = `translateX(${direction > 0 ? "40px" : "-40px"})`;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      contentEl.innerHTML = slide.content;
      contentEl.style.transform = "";
      contentEl.classList.add("visible");

      if (slide.label === "Introduction")              slideOneMap();
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
        ? `Global average: ${t.toFixed(2)} °C`
        : "No data for this year";
      showTip(event, `<strong>Global Average</strong>${t != null ? t.toFixed(2) + " °C" : "No data"}`);
    })
    .on("mouseleave", hideTip);
}

function updateMapOne(year) {
  const yearData   = climateDataGlobal.filter(d => +d.year === year);
  const validTemps = yearData.map(d => +d.mean_temp).filter(t => !isNaN(t));
  const avg        = validTemps.length
    ? validTemps.reduce((s, t) => s + t, 0) / validTemps.length
    : null;

  globalDataState.averageTemperature = avg;
  const colorOne = d3.scaleSequential().domain([0, 30]).interpolator(d3.interpolateReds);
  d3.select("#map svg .global-landmass")
    .transition().duration(120)
    .attr("fill", avg == null ? "rgba(255,255,255,0.06)" : colorOne(avg));
}

// Slide 2

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

  historicalData.forEach(d => d.type = "historical");
  projectedData.forEach(d  => d.type = "projected");

  const margin = { top: 16, right: 24, bottom: 38, left: 56 };
  const totalW = 900, totalH = 340;
  const W = totalW - margin.left - margin.right;
  const H = totalH - margin.top  - margin.bottom;

  const svg = d3.select("#chart").append("svg")
    .attr("viewBox", `0 0 ${totalW} ${totalH}`)
    .attr("width", "100%")
    .style("overflow", "visible");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  let allData = [...historicalData];

  const x = d3.scaleBand().domain(allData.map(d => d.year)).range([0, W]).padding(0.2);
  const y = d3.scaleLinear()
    .domain([d3.min(allData, d => d.temp) - 0.2, d3.max(allData, d => d.temp) + 0.3])
    .range([H, 0]);

  const colorScale = d3.scaleDiverging()
    .domain([d3.min(allData, d => d.temp), 0, d3.max(allData, d => d.temp)])
    .interpolator(t => d3.interpolateRdBu(1 - t));

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
    const tickYears = x.domain().filter(y => y % 20 === 0);
    xAxisG.call(d3.axisBottom(x).tickValues(tickYears).tickFormat(d3.format("d")));
    yAxisG.call(d3.axisLeft(y).ticks(6).tickFormat(d => `${d >= 0 ? "+" : ""}${d.toFixed(1)}°C`));
    styleAxes();
  }

  updateGrid(y);
  renderAxes();

  g.append("text")
    .attr("transform", "rotate(-90)").attr("y", -48).attr("x", -H / 2)
    .attr("text-anchor", "middle").attr("fill", "#7a7870").style("font-size", "10px")
    .text("Anomaly vs. 1850–1900 baseline (°C)");

  const zeroline = g.append("line")
    .attr("x1", 0).attr("x2", W).attr("y1", y(0)).attr("y2", y(0))
    .attr("stroke", "rgba(255,255,255,0.3)").attr("stroke-dasharray", "4,3").attr("stroke-width", 1);

  function drawBars(data, animate) {
    const bars = g.selectAll(".bar").data(data, d => d.year);
    bars.enter().append("rect")
      .attr("class", d => `bar bar-${d.type}`)
      .attr("fill",   d => colorScale(d.temp))
      .attr("x",      d => x(d.year))
      .attr("width",  x.bandwidth())
      .attr("y", H).attr("height", 0)
      .on("mousemove", (event, d) => showTip(event,
        `<strong>${d.year}</strong>${d.temp >= 0 ? "+" : ""}${d.temp.toFixed(2)} °C anomaly`))
      .on("mouseleave", hideTip)
      .transition()
        .duration(animate ? 600 : 350)
        .delay((_, i) => animate ? i * 4 : 0)
        .attr("y",      d => d.temp >= 0 ? y(d.temp) : y(0))
        .attr("height", d => Math.abs(y(d.temp) - y(0)));
    bars.transition().duration(500)
      .attr("x",      d => x(d.year)).attr("width",  x.bandwidth())
      .attr("fill",   d => colorScale(d.temp))
      .attr("y",      d => d.temp >= 0 ? y(d.temp) : y(0))
      .attr("height", d => Math.abs(y(d.temp) - y(0)));
  }

  drawBars(historicalData, false);

  document.getElementById("btn-project").addEventListener("click", function () {
    this.disabled = true;
    document.getElementById("btn-reset").disabled = false;
    document.getElementById("legend-proj").style.display = "inline";
    allData = [...historicalData, ...projectedData];
    x.domain(allData.map(d => d.year));
    y.domain([d3.min(allData, d => d.temp) - 0.2, d3.max(allData, d => d.temp) + 0.3]);
    const tickYears = x.domain().filter(yr => yr % 20 === 0);
    xAxisG.transition().duration(500).call(d3.axisBottom(x).tickValues(tickYears).tickFormat(d3.format("d")));
    yAxisG.transition().duration(500).call(d3.axisLeft(y).ticks(6).tickFormat(d => `${d >= 0 ? "+" : ""}${d.toFixed(1)}°C`));
    styleAxes(); updateGrid(y);
    zeroline.transition().duration(500).attr("y1", y(0)).attr("y2", y(0));
    drawBars(allData, true);
  });

  document.getElementById("btn-reset").addEventListener("click", function () {
    this.disabled = true;
    document.getElementById("btn-project").disabled = false;
    document.getElementById("legend-proj").style.display = "none";
    g.selectAll(".bar-projected").transition().duration(300).attr("y", H).attr("height", 0).remove();
    allData = [...historicalData];
    x.domain(allData.map(d => d.year));
    y.domain([d3.min(allData, d => d.temp) - 0.2, d3.max(allData, d => d.temp) + 0.3]);
    setTimeout(() => {
      const tickYears = x.domain().filter(yr => yr % 20 === 0);
      xAxisG.transition().duration(500).call(d3.axisBottom(x).tickValues(tickYears).tickFormat(d3.format("d")));
      yAxisG.transition().duration(400).call(d3.axisLeft(y).ticks(6).tickFormat(d => `${d >= 0 ? "+" : ""}${d.toFixed(1)}°C`));
      styleAxes(); updateGrid(y);
      zeroline.transition().duration(400).attr("y1", y(0)).attr("y2", y(0));
      drawBars(historicalData, false);
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
  geoDataGlobal.features.forEach(d => {
    const name = nameFixes[d.properties.name] ?? d.properties.name;
    d.properties.temperature = tempMap.get(name) ?? null;
  });
  renderMapThree();
}

function renderMapThree() {
  d3.select("#map svg").remove();
  const mapEl = document.getElementById("map");
  const width  = mapEl.clientWidth  || 680;
  const height = mapEl.clientHeight || 460;

  const svg = d3.select("#map").append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%").attr("height", "100%");

  const projection = d3.geoNaturalEarth1().scale(width / 5.2).translate([width / 2, height / 2]);
  const path  = d3.geoPath(projection);
  const color = d3.scaleSequential().domain([0, 30]).interpolator(d3.interpolateReds);

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
      showTip(event, `<strong>${d.properties.name}</strong>${t != null ? t.toFixed(1) + " °C" : "No data"}`);
    })
    .on("mouseleave", hideTip);
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

// Slide 5

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
  buildZoomedUSMap("#us-map-5", true);
}

// Slide 7

let slide7Season = "winter";
let slide7Year   = 1900;

async function slideSevenWorld() {
  await ensureBaseData();
  d3.select("#map-7").html("");

  await Promise.all([
    ensureSeasonalData("country", "historical"),
    ensureSeasonalData("global",  "historical"),
  ]);

  slide7Year = currentYear;
  renderSeasonWorldMap();

  const slider = document.getElementById("year-slider-7");
  const label  = document.getElementById("year-label-7");
  if (slider && label) {
    slider.value = slide7Year;
    label.textContent = slide7Year;
    slider.oninput = e => {
      slide7Year = +e.target.value;
      label.textContent = slide7Year;
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
  if (slide7Season === "winter") {
    cb.style.background = "linear-gradient(to right, #2166ac, #abd9e9, #f7f7f7)";
    if (lo) lo.textContent = "−15°C";
    if (hi) hi.textContent = "20°C";
  } else {
    cb.style.background = "linear-gradient(to right, #fee090, #fc8d59, #d73027)";
    if (lo) lo.textContent = "5°C";
    if (hi) hi.textContent = "40°C";
  }
}

function renderSeasonWorldMap() {
  d3.select("#map-7 svg").remove();

  const rows = seasonalCache.historical.country || [];
  const tempMap = buildSeasonalTempMap(rows, slide7Year, slide7Season);

  
  geoDataGlobal.features.forEach(f => {
    const name = nameFixes[f.properties.name] ?? f.properties.name;
    f.properties.seasonTemp = tempMap.get(name) ?? null;
  });

  const mapEl  = document.getElementById("map-7");
  const width  = mapEl.clientWidth  || 680;
  const height = mapEl.clientHeight || 460;

  const svg = d3.select("#map-7").append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%").attr("height", "100%");

  const projection = d3.geoNaturalEarth1().scale(width / 5.2).translate([width / 2, height / 2]);
  const path  = d3.geoPath(projection);


  const color = slide7Season === "winter"
    ? d3.scaleSequential().domain([-15, 20]).interpolator(d3.interpolateBlues)
    : d3.scaleSequential().domain([5, 40]).interpolator(d3.interpolateOrRd);

  svg.selectAll("path")
    .data(geoDataGlobal.features)
    .join("path")
    .attr("d",    path)
    .attr("fill", f => f.properties.seasonTemp == null
      ? "rgba(255,255,255,0.06)"
      : color(f.properties.seasonTemp))
    .attr("stroke", "rgba(255,255,255,0.15)").attr("stroke-width", 0.4)
    .on("mousemove", (event, f) => {
      const t = f.properties.seasonTemp;
      const label = slide7Season === "winter" ? "Winter" : "Summer";
      showTip(event, `<strong>${f.properties.name}</strong>${t != null ? `${label}: ${t.toFixed(1)} °C` : "No data"}`);
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

// Slide 9

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

  await paintUSSeasonMap("#us-map-9", "summer", "historical", 2014);
}

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
    ? d3.scaleSequential().domain([-15, 20]).interpolator(d3.interpolateBlues)
    : d3.scaleSequential().domain([5, 40]).interpolator(d3.interpolateOrRd);

  const svg = d3.select(containerSelector).append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%").attr("height", "100%");

  const projection = d3.geoNaturalEarth1().scale(width / 5.2).translate([width / 2, height / 2]);
  const path = d3.geoPath(projection);

  const countries = svg.selectAll("path")
    .data(geoDataGlobal.features)
    .join("path")
    .attr("d", path)
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

  countries.transition().duration(2000).ease(d3.easeCubicInOut)
    .tween("zoomToUS", () => {
      const iS = d3.interpolate(projection.scale(),     targetProj.scale());
      const iT = d3.interpolate(projection.translate(), targetProj.translate());
      return t => { projection.scale(iS(t)).translate(iT(t)); countries.attr("d", path); };
    });

  countries.transition().delay(1600).duration(700)
    .attr("opacity", f => isUS(f) ? 1 : 0.06)
    .attr("stroke",  f => isUS(f) ? "white" : "#222")
    .attr("stroke-width", f => isUS(f) ? 1.5 : 0.3);
}

// Slide 10

async function slideTenUSStates() {
  await ensureBaseData();
  d3.select("#us-map-10").html("");

  const year = 2014;
  annotateGeoWithYear(year);

  const container = document.querySelector("#us-map-10");
  if (!container) return;

  const width  = container.clientWidth  || 700;
  const height = container.clientHeight || 420;
  const color  = d3.scaleSequential().domain([0, 30]).interpolator(d3.interpolateReds);

  const usFeature = geoDataGlobal.features.find(f => isUS(f));
  if (!usFeature) return;

  const projection = d3.geoNaturalEarth1();
  projection.fitSize([width * 0.9, height * 0.9], usFeature);
  projection.translate([
    projection.translate()[0] + width  * 0.05,
    projection.translate()[1] + height * 0.05,
  ]);
  const path = d3.geoPath(projection);

  const svg = d3.select("#us-map-10").append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%").attr("height", "100%");

  // Background countries faded
  svg.selectAll(".country-bg")
    .data(geoDataGlobal.features)
    .join("path")
    .attr("class", "country-bg").attr("d", path)
    .attr("fill", f => f.properties.temperature == null ? "#1a1a1a" : color(f.properties.temperature))
    .attr("stroke", "#111").attr("stroke-width", 0.3)
    .attr("opacity", f => isUS(f) ? 0 : 0.04);

  // US highlighted
  svg.append("path")
    .datum(usFeature).attr("d", path)
    .attr("fill", f => {
      const t = f.properties.temperature;
      return t != null ? color(t) : "var(--accent)";
    })
    .attr("stroke", "rgba(255,255,255,0.5)").attr("stroke-width", 1.5)
    .attr("opacity", 0)
    .transition().delay(200).duration(800).attr("opacity", 1);

  // State borders if available
  d3.json("data/us-states.geojson").then(statesGeo => {
    if (!statesGeo) return;
    svg.selectAll(".state")
      .data(statesGeo.features)
      .join("path")
      .attr("class", "state").attr("d", path)
      .attr("fill", "transparent")
      .attr("stroke", "rgba(255,255,255,0.35)").attr("stroke-width", 0.8)
      .attr("opacity", 0)
      .transition().delay(800).duration(600).attr("opacity", 1);
  }).catch(() => {
    svg.append("text")
      .attr("x", width / 2).attr("y", height - 18)
      .attr("text-anchor", "middle")
      .attr("fill", "rgba(255,255,255,0.25)")
      .attr("font-size", "11px").attr("font-family", "var(--font-ui)")
      .text("Add data/us-states.geojson for state-level detail");
  });
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

/** Build a zoomed-to-US world map (used by slides 4 & 5). */
function buildZoomedUSMap(containerSelector, highlight) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  const width  = container.clientWidth  || 700;
  const height = container.clientHeight || 500;
  const color  = d3.scaleSequential().domain([0, 30]).interpolator(d3.interpolateReds);

  const svg = d3.select(containerSelector).append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%").attr("height", "100%");

  const projection = d3.geoNaturalEarth1().scale(width / 5.2).translate([width / 2, height / 2]);
  const path = d3.geoPath(projection);

  const countries = svg.selectAll("path")
    .data(geoDataGlobal.features)
    .join("path")
    .attr("d", path)
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

  const targetProj = d3.geoNaturalEarth1();
  targetProj.fitSize([width * 0.85, height * 0.85], usFeature);

  countries.transition().duration(2000).ease(d3.easeCubicInOut)
    .tween("zoomToUS", () => {
      const iS = d3.interpolate(projection.scale(),     targetProj.scale());
      const iT = d3.interpolate(projection.translate(), targetProj.translate());
      return t => { projection.scale(iS(t)).translate(iT(t)); countries.attr("d", path); };
    });

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
