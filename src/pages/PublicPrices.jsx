import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { peso, CLINIC_NAME } from "../lib/format";
import { ArrowLeft, Stethoscope } from "lucide-react";
import Pagination from "../components/Pagination";
import DebouncedSearchInput from "../components/DebouncedSearchInput";
import ThemeToggle from "../components/ThemeToggle";

function handleAppLink(event, navigate) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate?.();
}

export default function PublicPrices({ onBack }) {
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    let active = true;
    async function loadPrices() {
      setLoading(true);
      setError("");
      const { data, error: loadError } = await supabase
        .from("public_product_prices")
        .select("id, name, category, price")
        .in("category", ["Medicine", "Service"])
        .order("category")
        .order("name");
      if (!active) return;
      if (loadError) setError(loadError.message);
      setProducts(data || []);
      setLoading(false);
    }
    loadPrices();
    return () => { active = false; };
  }, []);

  const query = search.trim().toLowerCase();
  const shown = products.filter((p) =>
    (category === "All" || p.category === category) &&
    p.name?.toLowerCase().includes(query)
  );
  const totalPages = Math.max(1, Math.ceil(shown.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedShown = shown.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => { setPage(1); }, [search, category]);
  const groups = ["Medicine", "Service"]
    .map((name) => ({ name, items: pagedShown.filter((p) => p.category === name) }))
    .filter((group) => category === "All" || group.name === category);

  return (
    <div className="public-prices">
      <main className="public-prices-content">
        <header className="public-prices-header">
          <div className="public-prices-brand">
            <span className="brand-mark"><Stethoscope size={22} /></span>
            <div><h1>{CLINIC_NAME}</h1><p className="muted">Medicine & Service Prices</p></div>
          </div>
          <div className="public-header-actions">
            <ThemeToggle />
            <a className="btn" href="/login" onClick={(event) => handleAppLink(event, onBack)}><ArrowLeft size={16} /> Back to Login</a>
          </div>
        </header>

        <div className="card public-prices-toolbar">
          <div className="chips">
            {["All", "Medicine", "Service"].map((name) => (
              <button key={name} type="button" className={category === name ? "chip active" : "chip"} onClick={() => setCategory(name)}>{name}</button>
            ))}
          </div>
          <DebouncedSearchInput className="search" inputProps={{ "aria-label": "Search prices" }} placeholder="Search medicines or services..." onSearch={setSearch} />
        </div>

        {loading ? (
          <div className="card public-prices-state" role="status">Loading prices...</div>
        ) : error ? (
          <div className="card public-prices-state error">Could not load prices: {error}</div>
        ) : shown.length === 0 ? (
          <div className="card public-prices-state"><h3>No prices found</h3><p className="muted">Try another search or category.</p></div>
        ) : (
          groups.map((group) => group.items.length > 0 && (
            <section className="public-price-section" key={group.name}>
              <h2>{group.name === "Medicine" ? "Medicines" : "Services"}</h2>
              <div className="public-price-grid">
                {group.items.map((product) => (
                  <article className="public-price-card" key={product.id}>
                    <div><span className="tag blue">{product.category}</span><h3>{product.name}</h3></div>
                    <strong>{peso(product.price)}</strong>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
        <Pagination page={page} setPage={setPage} totalItems={shown.length} pageSize={pageSize} />
      </main>
    </div>
  );
}
