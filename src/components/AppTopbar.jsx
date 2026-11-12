import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Search } from "lucide-react";

const PAGE_LABELS = {
  dashboard: "Dashboard",
  patients: "Patients",
  consultations: "Consultations",
  appointments: "Appointments",
  pos: "Medical POS",
  inventory: "Inventory",
  sales: "Sales Transactions",
  staff: "Doctors & Staff",
  audit: "Audit Log",
};

export default function AppTopbar({ page, role, email, pages, onNavigate }) {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const searchRef = useRef(null);
  const searchWrapRef = useRef(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    function handleShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    function handleOutsideClick(event) {
      if (!searchWrapRef.current?.contains(event.target)) setShowResults(false);
    }
    window.addEventListener("keydown", handleShortcut);
    document.addEventListener("pointerdown", handleOutsideClick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("keydown", handleShortcut);
      document.removeEventListener("pointerdown", handleOutsideClick);
    };
  }, []);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    return pages
      .filter((id) => !term || PAGE_LABELS[id]?.toLowerCase().includes(term))
      .slice(0, 5);
  }, [pages, query]);

  function navigate(id) {
    onNavigate(id);
    setQuery("");
    setShowResults(false);
  }

  const initials = (email || "User")
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  return (
    <header className="app-topbar">
      <div className="app-topbar-search-wrap" ref={searchWrapRef}>
        <div className="app-topbar-search">
          <Search size={17} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            aria-label="Search pages"
            aria-expanded={showResults && results.length > 0}
            placeholder="Search pages..."
            value={query}
            onFocus={() => setShowResults(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setShowResults(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setShowResults(false);
              if (event.key === "Enter" && results[0]) navigate(results[0]);
            }}
          />
          <kbd>Ctrl/⌘ K</kbd>
        </div>
        {showResults && (
          <div className="app-topbar-results" role="listbox" aria-label="Page search results">
            {results.length ? results.map((id) => (
              <button key={id} type="button" role="option" aria-selected={page === id} onClick={() => navigate(id)}>
                <span>{PAGE_LABELS[id]}</span>
                <small>/{id}</small>
              </button>
            )) : <p>No matching pages</p>}
          </div>
        )}
      </div>
      <div className="app-topbar-context">
        <div className="app-topbar-date">
          <CalendarDays size={16} aria-hidden="true" />
          <span>{now.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" })} · {now.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}</span>
        </div>
        <div className="app-topbar-user" title={email}>
          <span className="app-topbar-avatar" aria-hidden="true">{initials}</span>
          <span className="app-topbar-user-details"><b>{email?.split("@")[0] || "Clinic user"}</b><small>{role}</small></span>
        </div>
      </div>
    </header>
  );
}
