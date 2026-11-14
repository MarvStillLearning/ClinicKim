import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import "./table-scroll.css";

const savedTheme = localStorage.getItem("clinic-theme");
document.documentElement.dataset.theme = savedTheme ||
  (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
