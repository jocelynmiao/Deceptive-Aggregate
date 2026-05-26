const slides = [
      {
        label: "Introduction",
        content:  `
          <div class="slide-layout">
            <div class="text-panel">
              <h3>Displaying Global Average</h3>
              <p>subheader placeholder</p>
            </div>

            <div id="map"></div>
          </div>
        `,
        annotation: "slide notes"
      },
      {
        label: "Slide 2",
        content: "text here",
        annotation: "slide notes"
      },
      {
        label: "Slide 3",
        content: "text here",
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

    let current = 0;

    function render() {
      const slide = slides[current];
      document.getElementById("slide-label").textContent = slide.label;
      document.getElementById("content").innerHTML = slide.content;
      document.getElementById("annotation").innerHTML = slide.annotation;
      document.getElementById("prev-btn").disabled = current === 0;
      document.getElementById("next-btn").disabled = current === slides.length - 1;
      document.getElementById("progress").textContent = `Slide ${current + 1} of ${slides.length}`;

      if (slide.label === "Introduction") {
        slideOneMap();
      }
    }

    function changeSlide(dir) {
      current = Math.max(0, Math.min(slides.length - 1, current + dir));
      render();
    }

    render();

    document.getElementById("prev-btn").addEventListener("click", function() { changeSlide(-1); });
    document.getElementById("next-btn").addEventListener("click", function() { changeSlide(1); });

    async function slideOneMap() {
      d3.select("#map").html("");
      const [geoData, climateData] = await Promise.all([
        d3.json("data/world.geojson"),
        d3.csv("data/yearly_country_temp_historical.csv")
      ]);

      const yearData = climateData.filter(
        d => d.year === "1900"
      );

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

      geoData.features.forEach(d => {
        let countryName = d.properties.name;
        if (nameFixes[countryName]) {
          countryName = nameFixes[countryName];
        }
        d.properties.temperature =
          tempMap.get(countryName);
      });

      

      const width = 700;
      const height = 500;

      const svg = d3.select("#map")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

      const tooltip = d3.select("body")
        .append("div")
        .style("position", "absolute")
        .style("background", "white")
        .style("padding", "6px 10px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("opacity", 0);

      const projection = d3.geoNaturalEarth1()
        .scale(140)
        .translate([width / 2, height / 2]);

      const path = d3.geoPath(projection);

      const color = d3.scaleSequential()
        .domain([0, 30])
        .interpolator(d3.interpolateReds);

      svg.selectAll("path")
        .data(geoData.features)
        .join("path")
        .attr("d", path)
        .attr("fill", d => {
          const temp = d.properties.temperature;
          return temp == null ? "#ccc" : color(temp);
        })
        .attr("stroke", "white")
        .attr("stroke-width", 0.5)

        .on("mouseover", (event, d) => {
          tooltip
            .style("opacity", 1)
            .html(`
              <strong>${d.properties.name}</strong><br/>
              Temp: ${d.properties.temperature ?? "No data"}
            `);
        })

        .on("mousemove", (event) => {
          tooltip
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY + 10) + "px");
        })

        .on("mouseout", () => {
          tooltip.style("opacity", 0);
        });

      console.log(climateData.slice(0,5));
      console.log(yearData.length);

    } 