import Sketch from "./app/three.js";
import "./styles/main.css";

const container = document.querySelector("#container");
const title = document.querySelector("#hero-title");

if (container) {
  new Sketch({
    dom: container,
  });

  // Reveal title only after the WebGL plane has painted
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (title) title.classList.add("is-ready");
    });
  });
}
