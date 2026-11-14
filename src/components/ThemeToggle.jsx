import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

function storedTheme() {
  const saved = window.localStorage.getItem("clinic-theme");
  return saved ? saved === "dark" : document.documentElement.dataset.theme === "dark";
}

export default function ThemeToggle({ className = "" }) {
  const [dark, setDark] = useState(storedTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    window.localStorage.setItem("clinic-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <button
      className={`theme-toggle${className ? ` ${className}` : ""}`}
      type="button"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      onClick={() => setDark((current) => !current)}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
