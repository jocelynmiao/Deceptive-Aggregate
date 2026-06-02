let historicalData    = null;
let projectedData     = null;
let geoDataGlobal     = null;
let climateDataGlobal = null;
let currentYear       = 1900;
let currentSlide      = 0;

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
  {
    label: "Zooming Into the U.S.",
    content: `
    <div class="slide-layout">
      <div class="text-panel">
        <h3>Slide 04 — Localizing Climate Change</h3>
        <h2>Zooming Into<br>the United States</h2>
        <p>
          Global temperature trends provide a useful
          overview, but they can hide regional
          differences.

          Lets compare a specific country with the global average. 
        </p>
        <div id="comparison-cards">
          <div class="stat-card">
            <div class="stat-value" id="global-temp-readout">--</div>
            <div class="stat-label">Global Average</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" id="us-temp-readout">--</div>
            <div class="stat-label">United States Average</div>
          </div>
        </div>
      </div>
      <div id="us-map"></div>
    </div>`
  },
  {
    label: "Conclusion",
    content: `
      <div class="text-slide">
        <p class="eyebrow">Slide 05 — Conclusion</p>
        <h1>Add more maps / visuals / conclusion slide</h1>
        <p class="lead">title</p>
        <p>text</p>
      </div>`
    }
];

function render(direction = 1) {
  const slide = slides[currentSlide];

  // Header
  document.getElementById("slide-label").textContent = slide.label;

  // Progress bar
  const pct = ((currentSlide) / (slides.length - 1)) * 100;
  document.getElementById("progress-bar-fill").style.width = pct + "%";

  // Nav buttons
  document.getElementById("prev-btn").disabled = currentSlide === 0;
  document.getElementById("next-btn").disabled = currentSlide === slides.length - 1;

  // Slide content with enter animation
  const contentEl = document.getElementById("content");
  contentEl.classList.remove("visible");
  contentEl.style.transform = `translateX(${direction > 0 ? "40px" : "-40px"})`;

  // Short delay so browser registers the class removal before re-adding
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      contentEl.innerHTML = slide.content;
      contentEl.style.transform = "";
      contentEl.classList.add("visible");

      // Mount charts/maps after DOM is ready
      if (slide.label === "Introduction") slideOneMap();
      if (slide.label === "Global Temperature Trend") slideTwoChart();
      if (slide.label === "Country-Level Breakdown")  slideThreeMap();
      if (slide.label === "Zooming Into the U.S.") slideFourUS();
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

// Keyboard navigation
window.addEventListener("keydown", e => {
  if (e.key === "ArrowRight" || e.key === "ArrowDown") changeSlide(1);
  if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   changeSlide(-1);
});


// Slide 1
let globalDataState = { averageTemperature: null };

async function slideOneMap() {
  d3.select("#map").html("");

  // Reuse the shared geo + climate cache
  if (!geoDataGlobal || !climateDataGlobal) {
    [geoDataGlobal, climateDataGlobal] = await Promise.all([
      d3.json("data/world.geojson"),
      d3.csv("data/yearly_country_temp_historical.csv")
    ]);
  }

  initMapOne();
  updateMapOne(currentYear);

  const slider = document.getElementById("year-slider");
  const label  = document.getElementById("year-label");
  if (slider && label) {
    label.textContent = currentYear;
    slider.value = currentYear;
    // oninput replaces any previous listener since it overwrites the property
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

  // Single unified path — no internal borders
  svg.append("path")
    .datum(geoDataGlobal)
    .attr("class", "global-landmass")
    .attr("d", d3.geoPath(proj))
    .attr("stroke", "none")
    .attr("fill", "rgba(255,255,255,0.06)")
    .on("mousemove", event => {
      const t = globalDataState.averageTemperature;
      // Also update the in-slide readout
      const readout = document.getElementById("globe-temp-readout");
      if (readout) readout.textContent = t != null
        ? `Global average: ${t.toFixed(2)} °C`
        : "No data for this year";
      showTip(event,
        `<strong>Global Average</strong>${t != null ? t.toFixed(2) + " °C" : "No data"}`);
    })
    .on("mouseleave", () => {
      hideTip();
    });
}

function updateMapOne(year) {
  const yearData   = climateDataGlobal.filter(d => +d.year === year);
  const validTemps = yearData.map(d => +d.mean_temp).filter(t => !isNaN(t));
  const avg        = validTemps.length > 0
    ? validTemps.reduce((s, t) => s + t, 0) / validTemps.length
    : null;

  globalDataState.averageTemperature = avg;

  const colorOne = d3.scaleSequential().domain([0, 30]).interpolator(d3.interpolateReds);

  d3.select("#map svg .global-landmass")
    .transition().duration(120)
    .attr("fill", avg == null ? "rgba(255,255,255,0.06)" : colorOne(avg));
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

  historicalData.forEach(d => d.type = "historical");
  projectedData.forEach(d =>  d.type = "projected");

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

  const x = d3.scaleBand()
    .domain(allData.map(d => d.year))
    .range([0, W]).padding(0.2);

  const y = d3.scaleLinear()
    .domain([d3.min(allData, d => d.temp) - 0.2, d3.max(allData, d => d.temp) + 0.3])
    .range([H, 0]);

  // Diverging colour: cool blues → warm reds
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

  function renderAxes() {
    const tickYears = x.domain().filter(y => y % 20 === 0);
    xAxisG.call(
      d3.axisBottom(x).tickValues(tickYears).tickFormat(d3.format("d"))
    );
    yAxisG.call(
      d3.axisLeft(y).ticks(6).tickFormat(d => `${d >= 0 ? "+" : ""}${d.toFixed(1)}°C`)
    );
    // Style axis lines
    xAxisG.selectAll("line, path").attr("stroke", "rgba(255,255,255,0.15)");
    yAxisG.selectAll("line, path").attr("stroke", "rgba(255,255,255,0.15)");
    xAxisG.selectAll("text").attr("fill", "#7a7870");
    yAxisG.selectAll("text").attr("fill", "#7a7870");
  }

  updateGrid(y);
  renderAxes();

  // Y-axis label
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -48).attr("x", -H / 2)
    .attr("text-anchor", "middle")
    .attr("fill", "#7a7870")
    .style("font-size", "10px")
    .text("Anomaly vs. 1850–1900 baseline (°C)");

  // Zero line
  const zeroline = g.append("line")
    .attr("x1", 0).attr("x2", W)
    .attr("y1", y(0)).attr("y2", y(0))
    .attr("stroke", "rgba(255,255,255,0.3)")
    .attr("stroke-dasharray", "4,3")
    .attr("stroke-width", 1);

  function drawBars(data, animate) {
    const bars = g.selectAll(".bar").data(data, d => d.year);

    bars.enter().append("rect")
      .attr("class", d => `bar bar-${d.type}`)
      .attr("fill",   d => colorScale(d.temp))
      .attr("x",      d => x(d.year))
      .attr("width",  x.bandwidth())
      .attr("y",      H)
      .attr("height", 0)
      .on("mousemove", (event, d) => showTip(event,
        `<strong>${d.year}</strong>${d.temp >= 0 ? "+" : ""}${d.temp.toFixed(2)} °C anomaly`))
      .on("mouseleave", hideTip)
      .transition()
        .duration(animate ? 600 : 350)
        .delay((_, i) => animate ? i * 4 : 0)
        .attr("y",      d => d.temp >= 0 ? y(d.temp) : y(0))
        .attr("height", d => Math.abs(y(d.temp) - y(0)));

    bars.transition().duration(500)
      .attr("x",      d => x(d.year))
      .attr("width",  x.bandwidth())
      .attr("fill",   d => colorScale(d.temp))
      .attr("y",      d => d.temp >= 0 ? y(d.temp) : y(0))
      .attr("height", d => Math.abs(y(d.temp) - y(0)));
  }

  drawBars(historicalData, false);

  //  Project button 
  document.getElementById("btn-project").addEventListener("click", function () {
    this.disabled = true;
    document.getElementById("btn-reset").disabled = false;
    document.getElementById("legend-proj").style.display = "inline";

    allData = [...historicalData, ...projectedData];
    x.domain(allData.map(d => d.year));
    y.domain([d3.min(allData, d => d.temp) - 0.2, d3.max(allData, d => d.temp) + 0.3]);

    const tickYears = x.domain().filter(yr => yr % 20 === 0);
    xAxisG.transition().duration(500)
      .call(d3.axisBottom(x).tickValues(tickYears).tickFormat(d3.format("d")));
    yAxisG.transition().duration(500)
      .call(d3.axisLeft(y).ticks(6).tickFormat(d => `${d >= 0 ? "+" : ""}${d.toFixed(1)}°C`));
    xAxisG.selectAll("line, path").attr("stroke", "rgba(255,255,255,0.15)");
    yAxisG.selectAll("line, path").attr("stroke", "rgba(255,255,255,0.15)");
    xAxisG.selectAll("text").attr("fill", "#7a7870");
    yAxisG.selectAll("text").attr("fill", "#7a7870");
    updateGrid(y);
    zeroline.transition().duration(500).attr("y1", y(0)).attr("y2", y(0));
    drawBars(allData, true);
  });

  //  Reset button 
  document.getElementById("btn-reset").addEventListener("click", function () {
    this.disabled = true;
    document.getElementById("btn-project").disabled = false;
    document.getElementById("legend-proj").style.display = "none";

    g.selectAll(".bar-projected")
      .transition().duration(300)
      .attr("y", H).attr("height", 0)
      .remove();

    allData = [...historicalData];
    x.domain(allData.map(d => d.year));
    y.domain([d3.min(allData, d => d.temp) - 0.2, d3.max(allData, d => d.temp) + 0.3]);

    setTimeout(() => {
      const tickYears = x.domain().filter(yr => yr % 20 === 0);
      xAxisG.transition().duration(500)
        .call(d3.axisBottom(x).tickValues(tickYears).tickFormat(d3.format("d")));
      yAxisG.transition().duration(400)
        .call(d3.axisLeft(y).ticks(6).tickFormat(d => `${d >= 0 ? "+" : ""}${d.toFixed(1)}°C`));
      xAxisG.selectAll("line, path").attr("stroke", "rgba(255,255,255,0.15)");
      yAxisG.selectAll("line, path").attr("stroke", "rgba(255,255,255,0.15)");
      xAxisG.selectAll("text").attr("fill", "#7a7870");
      yAxisG.selectAll("text").attr("fill", "#7a7870");
      updateGrid(y);
      zeroline.transition().duration(400).attr("y1", y(0)).attr("y2", y(0));
      drawBars(historicalData, false);
    }, 320);
  });
}

// Slide 3
async function slideThreeMap() {
  d3.select("#map").html("");

  if (!geoDataGlobal || !climateDataGlobal) {
    [geoDataGlobal, climateDataGlobal] = await Promise.all([
      d3.json("data/world.geojson"),
      d3.csv("data/yearly_country_temp_historical.csv")
    ]);
  }

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

  const projection = d3.geoNaturalEarth1()
    .scale(width / 5.2)
    .translate([width / 2, height / 2]);

  const path  = d3.geoPath(projection);
  const color = d3.scaleSequential().domain([0, 30])
    .interpolator(d3.interpolateReds);

  svg.selectAll("path")
    .data(geoDataGlobal.features)
    .join("path")
    .attr("d",            path)
    .attr("fill",         d => d.properties.temperature == null
      ? "rgba(255,255,255,0.06)"
      : color(d.properties.temperature))
    .attr("stroke",       "rgba(255,255,255,0.15)")
    .attr("stroke-width", 0.4)
    .on("mousemove", (event, d) => {
      const t = d.properties.temperature;
      showTip(event,
        `<strong>${d.properties.name}</strong>${t != null ? t.toFixed(1) + " °C" : "No data"}`);
    })
    .on("mouseleave", hideTip);
}


async function slideFourUS() {
  

  d3.select("#us-map").html("");
  if (!geoDataGlobal || !climateDataGlobal) {
    [geoDataGlobal, climateDataGlobal] = await Promise.all([
      d3.json("data/world.geojson"),
      d3.csv("data/yearly_country_temp_historical.csv")
    ]);
  }
  
  const year = 1850;
  const usRow = climateDataGlobal.find(
    d =>
      +d.year === year &&
      (
        d.country === "USA" ||
        d.country === "United States of America"
      )
  );

  const usTemp = usRow ? +usRow.mean_temp : null;
  const yearRows = climateDataGlobal.filter(d => +d.year === year);
  const globalTemp = d3.mean(yearRows, d => +d.mean_temp);

  document.getElementById("global-temp-readout").textContent =globalTemp != null ? `${globalTemp.toFixed(1)}°C` : "--";
  document.getElementById("us-temp-readout").textContent = usTemp != null ? `${usTemp.toFixed(1)}°C` : "--";
  const yearData = climateDataGlobal.filter(d => +d.year === year);
  const tempMap = new Map(yearData.map(d => [d.country, +d.mean_temp]));

  geoDataGlobal.features.forEach(d => {
    const name = nameFixes[d.properties.name] ?? d.properties.name;
    d.properties.temperature = tempMap.get(name) ?? null;
  });

  createMapFour(globalTemp, usTemp);

}

function createMapFour(globalTemp, usTemp) {

  const container = document.getElementById("us-map");

  const width  = container.clientWidth  || 700;
  const height = container.clientHeight || 500;
  const color = d3.scaleSequential()
  .domain([0, 30])
  .interpolator(d3.interpolateReds);

  const svg = d3.select("#us-map")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("height", "100%");

  const worldProjection = d3.geoNaturalEarth1()
    .scale(width / 5.2)
    .translate([width / 2, height / 2]);

  const projection = d3.geoNaturalEarth1().scale(width / 5.2).translate([width / 2, height / 2]);

  const path = d3.geoPath(projection);

  const countries = svg.selectAll("path")
    .data(geoDataGlobal.features)
    .join("path")
    .attr("d", path)
    .attr("fill", d =>
      d.properties.temperature == null
        ? "rgba(255,255,255,0.06)"
        : color(d.properties.temperature)
    )
    .attr("stroke", "rgba(255,255,255,0.15)")
    .attr("stroke-width", 0.4)
    .attr("stroke", "#222")
    .attr("opacity", 0.6);

  const usFeature = geoDataGlobal.features.find(
    d => d.properties.name === "USA"
  );

  if (!usFeature) {
    console.error("USA feature not found");
    return;
  }

  // Build target projection
  const targetProjection = d3.geoNaturalEarth1();
  targetProjection.fitSize(
    [width * 0.85, height * 0.85],
    usFeature
  );

  countries.transition()
    .duration(2500)
    .ease(d3.easeCubicInOut)
    .tween("zoomToUS", () => {

      const interpScale = d3.interpolate(
        projection.scale(),
        targetProjection.scale()
      );

      const interpTranslate = d3.interpolate(
        projection.translate(),
        targetProjection.translate()
      );

      return t => {

        projection
          .scale(interpScale(t))
          .translate(interpTranslate(t));

        countries.attr("d", path);
      };
    });

  countries.transition()
    .delay(1800)
    .duration(700)
    .attr("opacity", d =>
      d.properties.name === "USA" ? 1 : 0.08
    )
    .attr("fill", d =>
      d.properties.name === "USA"
        ? "var(--accent)"
        : "#444"
    )
    .attr("stroke", d =>
      d.properties.name === "USA"
        ? "white"
        : "#222"
    )
    .attr("stroke-width", d =>
      d.properties.name === "USA"
        ? 1.5
        : 0.5
    );
}