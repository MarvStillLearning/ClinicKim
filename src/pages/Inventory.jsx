// Inventory: medicines and services (add, edit, delete).
import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { peso } from "../lib/format";
import { Search } from "lucide-react";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import ActionLoadingDialog from "../components/ActionLoadingDialog";

const CATEGORIES = ["Medicine", "Service"];
const emptyItem = { name: "", category: "Medicine", price: "", stock: "", expiry_date: "" };

export default function Inventory({ initialLowStockOnly = false }) {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyItem);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");
  const [lowStockOnly, setLowStockOnly] = useState(initialLowStockOnly);
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [actionType, setActionType] = useState("save");
  const pageSize = 10;

  async function load() {
    const { data } = await supabase.from("products").select("*").in("category", CATEGORIES).order("name");
    setProducts(data || []);
  }
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setActionType("save");
    const data = {
      name: form.name,
      category: form.category,
      price: Number(form.price),
      stock: Number(form.stock || 0),
      expiry_date: form.category === "Medicine" && form.expiry_date ? form.expiry_date : null,
    };
    const { error } = form.id
      ? await supabase.from("products").update(data).eq("id", form.id)
      : await supabase.from("products").insert(data);
    if (error) {
      setSaving(false);
      return alert(error.message);
    }
    setForm(emptyItem);
    setShowForm(false);
    load();
    setSaving(false);
  }
  async function remove(p) {
    if (!window.confirm("Delete " + p.name + "?")) return;
    setSaving(true);
    setActionType("delete");
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) {
      setSaving(false);
      alert("Cannot delete this item: " + error.message);
      return;
    }
    await load();
    setSaving(false);
  }

  const shown = products.filter((p) =>
    (cat === "All" || p.category === cat)
    && (!lowStockOnly || (p.category !== "Service" && Number(p.stock) <= 5))
    && p.name.toLowerCase().includes(search.toLowerCase()));
  const lowStock = products.filter((p) => p.category !== "Service" && Number(p.stock) <= 5);
  const expiringSoon = products.filter((p) => {
    if (!p.expiry_date) return false;
    const expiry = new Date(`${p.expiry_date}T23:59:59`);
    const limit = new Date();
    limit.setDate(limit.getDate() + 30);
    return expiry <= limit;
  });
  const totalPages = Math.max(1, Math.ceil(shown.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedShown = shown.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => { setPage(1); }, [search, cat, lowStockOnly]);

  return (
    <div>
      <div className="page-header">
        <h1>{lowStockOnly ? "Low Stock Inventory" : "Inventory"}</h1>
        <button className="btn primary" type="button" onClick={() => { setForm(emptyItem); setShowForm(true); }}>Add item</button>
      </div>

      <Modal title={form.id ? "Edit item" : "Add item"} open={showForm} onClose={() => setShowForm(false)} className="form-modal">
        <form className="form-grid" onSubmit={save}>
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Category
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Price (₱)<input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></label>
          <label>Stock {form.category === "Service" && <small>(not needed for services)</small>}
            <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          </label>
          {form.category === "Medicine" && (
            <label>Expiry date<input type="date" value={form.expiry_date || ""} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></label>
          )}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn primary" disabled={saving}>{saving ? "Saving..." : form.id ? "Update" : "Add item"}</button>
          </div>
        </form>
      </Modal>

      {lowStock.length > 0 && (
        <div className="alert" role="alert" style={{ marginBottom: 12 }}>
          <b>Low stock alert:</b>{" "}
          {lowStock.map((p) => `${p.name} (${p.stock} left)`).join(", ")}
        </div>
      )}
      {expiringSoon.length > 0 && (
        <div className="alert" role="alert" style={{ marginBottom: 12 }}>
          <b>Expiry alert:</b>{" "}
          {expiringSoon.map((p) => `${p.name} (${p.expiry_date})`).join(", ")}
        </div>
      )}

      <div className="card">
        <div className="toolbar">
          <div className="chips">
            {["All", ...CATEGORIES].map((c) => (
              <button key={c} className={!lowStockOnly && cat === c ? "chip active" : "chip"} onClick={() => { setCat(c); setLowStockOnly(false); }}>{c}</button>
            ))}
            <button type="button" className={lowStockOnly ? "chip active" : "chip"} onClick={() => setLowStockOnly(true)}>Low stock</button>
          </div>
          <div className="search"><Search size={16} /><input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
        {shown.length === 0 && <p className="muted">No inventory items match these filters.</p>}
        <div className="table-wrap">
        <table>
          <thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Stock</th><th>Expiry</th><th></th></tr></thead>
          <tbody>
            {pagedShown.map((p, index) => (
              <tr key={p.id}>
                <td><b>{(currentPage - 1) * pageSize + index + 1}</b>. {p.name}</td>
                <td><span className="tag blue">{p.category}</span></td>
                <td>{peso(p.price)}</td>
                <td>{p.category === "Service" ? "-" : <span className={p.stock <= 5 ? "tag red" : "tag green"}>{p.stock}</span>}</td>
                <td>{p.category === "Medicine" && p.expiry_date ? p.expiry_date : "-"}</td>
                <td className="right">
                  <button className="btn small" onClick={() => { setForm({ ...p, price: p.price, stock: p.stock }); setShowForm(true); }}>Edit</button>{" "}
                  <button className="btn small danger" onClick={() => remove(p)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <Pagination page={page} setPage={setPage} totalItems={shown.length} pageSize={pageSize} />
      </div>
      <ActionLoadingDialog
        open={saving}
        title={actionType === "delete" ? "Deleting inventory item" : form.id ? "Saving item changes" : "Adding inventory item"}
        description={actionType === "delete" ? "Removing the item from medicine and service inventory..." : "Saving inventory details and stock information..."}
        danger={actionType === "delete"}
      />
    </div>
  );
}
