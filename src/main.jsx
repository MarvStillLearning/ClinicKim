import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import "./table-scroll.css";

document.documentElement.dataset.theme =
  localStorage.getItem("clinic-theme") === "dark" ? "dark" : "light";

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
