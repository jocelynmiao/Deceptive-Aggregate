const slides = [
      {
        label: "Introduction",
        content: "text here",
        annotation: "slide notes"
      },
      {
        label: "Slide 2",
        content: "text here",
        annotation: "slide notes"
      },
      {
        label: "Slide 3",
        content: `
          <div class="slide-layout">
            <div class="text-panel">
              <h3>Historical Global Average (1850-2014)</h3>
              <p>subheader placeholder</p>
              <input id="year-slider" type="range" min="1850" max="2014" step="1" value="1900">
              <div>Year: <span id="year-label">1900</span></div>
            </div>

            <div id="map"></div>
          </div>
        `,
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
      document.getElementById("slide-label").textContent = slide.label;
      document.getElementById("content").innerHTML = slide.content;
      document.getElementById("annotation").innerHTML = slide.annotation;
      document.getElementById("prev-btn").disabled = currentSlide === 0;
      document.getElementById("next-btn").disabled = currentSlide === slides.length - 1;
      document.getElementById("progress").textContent = `Slide ${currentSlide + 1} of ${slides.length}`;

      if (slide.label === "Slide 3") {
        slideThreeMap();
      }
    }

    function changeSlide(dir) {
      currentSlide = Math.max(0, Math.min(slides.length - 1, currentSlide + dir));
      render();
    }

    render();

    document.getElementById("prev-btn").addEventListener("click", function() { changeSlide(-1); });
    document.getElementById("next-btn").addEventListener("click", function() { changeSlide(1); });

    let geoDataGlobal;
    let climateDataGlobal;
    let currentYear = 1850;


    //SLIDE THREE
    async function slideThreeMap() {
      d3.select("#map").html("");

      const [geoData, climateData] = await Promise.all([
        d3.json("data/world.geojson"),
        d3.csv("data/yearly_country_temp_historical.csv")
      ]);

      geoDataGlobal = geoData;
      climateDataGlobal = climateData;
      tooltip = d3.select("body")
        .append("div")
        .style("position", "absolute")
        .style("background", "white")
        .style("padding", "6px 10px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("opacity", 0);

      createMapThree(currentYear);
      setupYearSlider();
    }

    let tooltip;

    function renderMapThree() {
      d3.select("#map svg").remove();

      const width = 700;
      const height = 500;

      const svg = d3.select("#map")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

      const projection = d3.geoNaturalEarth1()
        .scale(140)
        .translate([width / 2, height / 2]);

      const path = d3.geoPath(projection);

      const color = d3.scaleSequential()
        .domain([0, 30])
        .interpolator(d3.interpolateReds);

      svg.selectAll("path")
        .data(geoDataGlobal.features)
        .join("path")
        .attr("d", path)
        .attr("fill", d => {
          const temp = d.properties.temperature;
          return temp == null ? "#ccc" : color(temp);
        })
        .attr("stroke", "white")
        .attr("stroke-width", 0.5)
        .on("mouseover", (event, d) => {
          tooltip.style("opacity", 1)
            .html(`<strong>${d.properties.name}</strong><br/>Temp: ${d.properties.temperature ?? "No data"}`);
        })
        .on("mousemove", (event) => {
          tooltip
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY + 10) + "px");
        })
        .on("mouseout", () => tooltip.style("opacity", 0));
    }

    function createMapThree(year) {
      const yearData = climateDataGlobal.filter(d => +d.year === +year);

      const tempMap = new Map();
      yearData.forEach(d => {
        tempMap.set(d.country, +d.mean_temp);
      });

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

      geoDataGlobal.features.forEach(d => {
        let countryName = d.properties.name;
        if (nameFixes[countryName]) {
          countryName = nameFixes[countryName];
        }
        d.properties.temperature = tempMap.get(countryName);
      });

      renderMapThree();
  }
let sliderInitialized = false;

function setupYearSlider() {
  if (sliderInitialized) return;
  sliderInitialized = true;

  const slider = document.getElementById("year-slider");
  const label = document.getElementById("year-label");

  slider.addEventListener("input", (e) => {
    currentYear = +e.target.value;
    label.textContent = currentYear;
    createMapThree(currentYear);
  });
}