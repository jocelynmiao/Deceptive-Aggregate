const slides = [
      {
        label: "Introduction",
        content: "text here, just some demo stuff, can def make it look better later",
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
    }

    function changeSlide(dir) {
      current = Math.max(0, Math.min(slides.length - 1, current + dir));
      render();
    }

    render();

    document.getElementById("prev-btn").addEventListener("click", function() { changeSlide(-1); });
    document.getElementById("next-btn").addEventListener("click", function() { changeSlide(1); });