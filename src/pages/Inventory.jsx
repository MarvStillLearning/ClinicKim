// Inventory: medicines and services (add, edit, delete).
import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { peso } from "../lib/format";
import { Search } from "lucide-react";
import Modal from "../components/Modal";

const CATEGORIES = ["Medicine", "Service"];
const emptyItem = { name: "", category: "Medicine", price: "", stock: "" };

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyItem);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");

  async function load() {
    const { data } = await supabase.from("products").select("*").in("category", CATEGORIES).order("name");
    setProducts(data || []);
  }
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    const data = { name: form.name, category: form.category, price: Number(form.price), stock: Number(form.stock || 0) };
    const { error } = form.id
      ? await supabase.from("products").update(data).eq("id", form.id)
      : await supabase.from("products").insert(data);
    if (error) return alert(error.message);
    setForm(emptyItem);
    setShowForm(false);
    load();
  }
  async function remove(p) {
    if (!window.confirm("Delete " + p.name + "?")) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) {
      alert("Cannot delete this item: " + error.message);
      return;
    }
    await load();
  }

  const shown = products.filter((p) =>
    (cat === "All" || p.category === cat) && p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <h1>Inventory</h1>
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
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn primary">{form.id ? "Update" : "Add item"}</button>
          </div>
        </form>
      </Modal>

      <div className="card">
        <div className="toolbar">
          <div className="chips">
            {["All", ...CATEGORIES].map((c) => (
              <button key={c} className={cat === c ? "chip active" : "chip"} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>
          <div className="search"><Search size={16} /><input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
        <table>
          <thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr></thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td><span className="tag blue">{p.category}</span></td>
                <td>{peso(p.price)}</td>
                <td>{p.category === "Service" ? "-" : <span className={p.stock <= 5 ? "tag red" : "tag green"}>{p.stock}</span>}</td>
                <td className="right">
                  <button className="btn small" onClick={() => { setForm({ ...p, price: p.price, stock: p.stock }); setShowForm(true); }}>Edit</button>{" "}
                  <button className="btn small danger" onClick={() => remove(p)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
