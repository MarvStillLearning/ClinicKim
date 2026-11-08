import { useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle({ className = "" }) {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark");

  function toggleTheme() {
    const nextDark = !dark;
    document.documentElement.dataset.theme = nextDark ? "dark" : "light";
    localStorage.setItem("clinic-theme", nextDark ? "dark" : "light");
    setDark(nextDark);
  }

  return (
    <button
      className={`theme-toggle ${className}`}
      type="button"
      aria-label={dark ? "Use light mode" : "Use dark mode"}
      title={dark ? "Use light mode" : "Use dark mode"}
      onClick={toggleTheme}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
