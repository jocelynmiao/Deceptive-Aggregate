let historicalData  = null;
let projectedData   = null;
let geoDataGlobal   = null;
let climateDataGlobal = null;
let currentYear     = 1900;

const tooltip = d3.select("body").append("div")
  .style("position",       "absolute")
  .style("background",     "#fff")
  .style("border",         "1px solid #ccc")
  .style("padding",        "5px 10px")
  .style("font-size",      "0.82em")
  .style("pointer-events", "none")
  .style("display",        "none");


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
    content: "text here",
    annotation: "slide notes"
  },
  {
    label: "Slide 2",
    content: `
      <h1>Global Mean Surface Temperature</h1>
      <div id="controls">
        <button id="btn-project">Show Projected (SSP5-8.5)</button>
        <button id="btn-reset" disabled>Reset</button>
      </div>
      <div id="chart"></div>
      <div id="legend">
        <span><span class="legend-swatch" style="background:#4a90c4"></span>Historical (CMIP6)</span>
        <span id="legend-proj" style="display:none">
          <span class="legend-swatch" style="background:#c0392b"></span>Projected SSP5-8.5
        </span>
      </div>`,
    annotation: "slide notes"
  },
  {
    label: "Slide 3",
    content: `
      <div class="slide-layout">
        <div class="text-panel">
          <h3>Historical Average Temperature by Country (1850–2014)</h3>
          <p>Subheader placeholder</p>
          <input id="year-slider" type="range" min="1850" max="2014" step="1" value="1900">
          <div>Year: <span id="year-label">1900</span></div>
        </div>
        <div id="map"></div>
      </div>`,
    annotation: "slide notes"
  },
  {
    label: "Slide 4",
    content: "text here",
    annotation: "slide notes"
  },
  {
    label: "Slide 5",
    content: "text here",
    annotation: "slide notes"
  }
];

let currentSlide = 0;

function render() {
  const slide = slides[currentSlide];
  document.getElementById("slide-label").textContent  = slide.label;
  document.getElementById("content").innerHTML        = slide.content;
  document.getElementById("annotation").innerHTML     = slide.annotation;
  document.getElementById("prev-btn").disabled        = currentSlide === 0;
  document.getElementById("next-btn").disabled        = currentSlide === slides.length - 1;
  document.getElementById("progress").textContent     = `Slide ${currentSlide + 1} of ${slides.length}`;

  if (slide.label === "Slide 2") slideTwoChart();
  if (slide.label === "Slide 3") slideThreeMap();
}

function changeSlide(dir) {
  currentSlide = Math.max(0, Math.min(slides.length - 1, currentSlide + dir));
  render();
}

render();
document.getElementById("prev-btn").addEventListener("click", () => changeSlide(-1));
document.getElementById("next-btn").addEventListener("click", () => changeSlide(1));

//SLIDE 2
async function slideTwoChart() {
  // Clear whatever was there on a previous visit
  d3.select("#chart").html("");

  // Load CSVs once, cache results
  if (!historicalData) {
    const rows = await d3.csv("data/yearly_global_temp_historical.csv");
    historicalData = aggregateByYear(rows);
  }
  if (!projectedData) {
    const rows = await d3.csv("data/yearly_global_temp_ssp245.csv");
    projectedData = aggregateByYear(rows);
  }

  // Tag each point so drawBars can tell them apart without a fragile .includes()
  historicalData.forEach(d => d.type = "historical");
  projectedData.forEach(d => d.type  = "projected");

  const margin = { top: 20, right: 30, bottom: 40, left: 55 };
  const totalW = 900, totalH = 420;
  const W = totalW - margin.left - margin.right;
  const H = totalH - margin.top  - margin.bottom;

  const svg = d3.select("#chart").append("svg")
    .attr("viewBox", `0 0 ${totalW} ${totalH}`)
    .attr("width", "100%");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  let allData = [...historicalData];

  const x = d3.scaleBand()
    .domain(allData.map(d => d.year))
    .range([0, W]).padding(0.25);

  const y = d3.scaleLinear()
    .domain([d3.min(allData, d => d.temp) - 0.2, d3.max(allData, d => d.temp) + 0.3])
    .range([H, 0]);
  const colorScale = d3.scaleDiverging()
  .domain([d3.min(allData, d => d.temp), 0, d3.max(allData, d => d.temp)])
  .interpolator(t => d3.interpolateRdBu(1 - t));

  const gridG = g.append("g").attr("class", "grid");
  const xAxisG = g.append("g").attr("class", "axis").attr("transform", `translate(0,${H})`);
  const yAxisG = g.append("g").attr("class", "axis");

  function updateGrid(yScale) {
    gridG.call(d3.axisLeft(yScale).tickSize(-W).tickFormat(""));
  }

  function renderAxes() {
  const tickYears = x.domain().filter(year => year % 20 === 0);

  xAxisG.call(
    d3.axisBottom(x)
      .tickValues(tickYears)
      .tickFormat(d3.format("d"))
  );

  yAxisG.call(
    d3.axisLeft(y)
      .ticks(6)
      .tickFormat(d => `+${d.toFixed(1)}°C`)
  );
  }

  updateGrid(y);
  renderAxes();

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -50).attr("x", -H / 2)
    .attr("text-anchor", "middle")
    .style("font-size", "11px").style("fill", "#555")
    .text("Anomaly vs. 1850–1900 baseline (°C)");

  const zeroline = g.append("line")
    .attr("x1", 0).attr("x2", W)
    .attr("y1", y(0)).attr("y2", y(0))
    .attr("stroke", "#999").attr("stroke-dasharray", "4,3").attr("stroke-width", 1);

  function drawBars(data, animate) {
    const bars = g.selectAll(".bar").data(data, d => d.year);

    bars.enter().append("rect")
      .attr("class", d => `bar bar-${d.type}`)
      .attr("fill", d => colorScale(d.temp))  
      .attr("x", d => x(d.year))
      .attr("width", x.bandwidth())
      .attr("y", H).attr("height", 0)
      .on("mousemove", (event, d) => {
        tooltip.style("display", "block")
          .style("left", (event.pageX + 12) + "px")
          .style("top",  (event.pageY - 28) + "px")
          .html(`<strong>${d.year}</strong><br>+${d.temp.toFixed(2)} °C`);
      })
      .on("mouseleave", () => tooltip.style("display", "none"))
      .transition()
        .duration(animate ? 600 : 400)
        .delay((_, i) => animate ? i * 5 : 0)
        .attr("y",      d => d.temp >= 0 ? y(d.temp) : y(0))
        .attr("height", d => Math.abs(y(d.temp) - y(0)));

    // Rescale existing bars
    bars.transition().duration(500)
      .attr("x", d => x(d.year)).attr("width", x.bandwidth())
      .attr("fill", d => colorScale(d.temp))
      .attr("y",      d => d.temp >= 0 ? y(d.temp) : y(0))
      .attr("height", d => Math.abs(y(d.temp) - y(0)));
  }

  drawBars(historicalData, false);

  document.getElementById("btn-project").addEventListener("click", function () {
    this.disabled = true;
    document.getElementById("btn-reset").disabled    = false;
    document.getElementById("legend-proj").style.display = "inline";

    allData = [...historicalData, ...projectedData];
    x.domain(allData.map(d => d.year));
    y.domain([d3.min(allData, d => d.temp) - 0.2, d3.max(allData, d => d.temp) + 0.3]);

    const tickYears = x.domain().filter(year => year % 20 === 0);
    xAxisG.transition().duration(500)
      .call(
        d3.axisBottom(x)
          .tickValues(tickYears)
          .tickFormat(d3.format("d"))
      );
    yAxisG.transition().duration(500).call(
      d3.axisLeft(y).ticks(6).tickFormat(d => `+${d.toFixed(1)}°C`)
    );
    updateGrid(y);
    zeroline.transition().duration(500).attr("y1", y(0)).attr("y2", y(0));
    drawBars(allData, true);
  });

  document.getElementById("btn-reset").addEventListener("click", function () {
    this.disabled = true;
    document.getElementById("btn-project").disabled      = false;
    document.getElementById("legend-proj").style.display = "none";

    g.selectAll(".bar-projected")
      .transition().duration(300)
      .attr("y", H).attr("height", 0)
      .remove();

    allData = [...historicalData];
    x.domain(allData.map(d => d.year));
    y.domain([d3.min(allData, d => d.temp) - 0.2, d3.max(allData, d => d.temp) + 0.3]);

    setTimeout(() => {
      const tickYears = x.domain().filter(year => year % 20 === 0);
      xAxisG.transition().duration(500)
      .call(
        d3.axisBottom(x)
          .tickValues(tickYears)
          .tickFormat(d3.format("d"))
      );
      yAxisG.transition().duration(400).call(
        d3.axisLeft(y).ticks(6).tickFormat(d => `+${d.toFixed(1)}°C`)
      );
      updateGrid(y);
      zeroline.transition().duration(400).attr("y1", y(0)).attr("y2", y(0));
      drawBars(historicalData, false);
    }, 320);
  });
}


//SLIDE 3
async function slideThreeMap() {
  d3.select("#map").html("");

  if (!geoDataGlobal || !climateDataGlobal) {
    [geoDataGlobal, climateDataGlobal] = await Promise.all([
      d3.json("data/world.geojson"),
      d3.csv("data/yearly_country_temp_historical.csv")
    ]);
  }

  createMapThree(currentYear);

  // Slider: attach fresh each time (element is recreated with slide HTML)
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
  const nameFixes = {
    "The Bahamas": "Bahamas",
    "Bosnia and Herzegovina": "Bosnia and Herz.",
    "Brunei": "Brunei Darussalam",
    "Central African Republic": "Central African Rep.",
    "Ivory Coast": "Côte d'Ivoire",
    "Democratic Republic of the Congo": "Dem. Rep. Congo",
    "England": "United Kingdom",
    "Republic of the Congo": "Congo",
    "Czech Republic": "Czechia",
    "Guinea Bissau": "Guinea-Bissau",
    "Macedonia": "North Macedonia",
    "Republic of Serbia": "Serbia",
    "Swaziland": "eSwatini",
    "East Timor": "Timor-Leste",
    "United Republic of Tanzania": "Tanzania",
    "USA": "United States of America"
  };

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

  const width = 700, height = 500;

  const svg = d3.select("#map").append("svg")
    .attr("width", width).attr("height", height);

  const projection = d3.geoNaturalEarth1()
    .scale(140).translate([width / 2, height / 2]);

  const path  = d3.geoPath(projection);
  const color = d3.scaleSequential().domain([0, 30]).interpolator(d3.interpolateReds);

  svg.selectAll("path")
    .data(geoDataGlobal.features)
    .join("path")
    .attr("d", path)
    .attr("fill",         d => d.properties.temperature == null ? "#ccc" : color(d.properties.temperature))
    .attr("stroke",       "white")
    .attr("stroke-width", 0.5)
    .on("mousemove", (event, d) => {
      const t = d.properties.temperature;
      tooltip.style("display", "block")
        .style("left", (event.pageX + 12) + "px")
        .style("top",  (event.pageY - 28) + "px")
        .html(`<strong>${d.properties.name}</strong><br>${t != null ? t.toFixed(1) + " °C" : "No data"}`);
    })
    .on("mouseleave", () => tooltip.style("display", "none"));
}