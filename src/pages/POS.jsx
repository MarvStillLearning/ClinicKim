// Cashier: pick items, add discount, take payment, give change, print receipt.
import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { peso, dateTime, CLINIC_NAME } from "../lib/format";
import { Search, Plus, Minus, Trash2 } from "lucide-react";
import Pagination from "../components/Pagination";
import ActionLoadingDialog from "../components/ActionLoadingDialog";
import Modal from "../components/Modal";

export default function POS({ user, initialLowStockOnly = false }) {
  const [products, setProducts] = useState([]);
  const [patients, setPatients] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");
  const [patientId, setPatientId] = useState("");
  const [discount, setDiscount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [paid, setPaid] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [productPage, setProductPage] = useState(1);
  const [cartPage, setCartPage] = useState(1);
  const [catalogOpen, setCatalogOpen] = useState(initialLowStockOnly);
  const [lowStockOnly, setLowStockOnly] = useState(initialLowStockOnly);
  const pageSize = 10;

  async function loadData() {
    const p = await supabase.from("products").select("*").in("category", ["Medicine", "Service"]).order("name");
    const pt = await supabase.from("patients").select("id, full_name").order("full_name");
    setProducts(p.data || []);
    setPatients(pt.data || []);
  }
  useEffect(() => { loadData(); }, []);

  const tracksStock = (item) => item.category !== "Service"; // services have no stock

  function toggleProductSelection(product) {
    const found = cart.find((c) => c.id === product.id);
    if (found) {
      setCart(cart.filter((item) => item.id !== product.id));
      return;
    }
    if (tracksStock(product) && product.stock < 1) return;
    setCart([...cart, { ...product, qty: 1 }]);
  }
  function changeQty(item, amount) {
    const newQty = item.qty + amount;
    if (newQty < 1) return setCart(cart.filter((c) => c.id !== item.id));
    if (tracksStock(item) && newQty > item.stock) return alert("Not enough stock");
    setCart(cart.map((c) => (c.id === item.id ? { ...c, qty: newQty } : c)));
  }

  // Payment math
  const subtotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  const disc = Math.min(Number(discount) || 0, subtotal);
  const total = subtotal - disc;
  const change = Number(paid) - total;

  async function checkout() {
    if (cart.length === 0) return alert("Cart is empty");
    if (Number(paid) < total) return alert("Payment is not enough");
    setSaving(true);
    const { data, error } = await supabase.rpc("checkout_sale", {
      p_patient_id: patientId ? Number(patientId) : null,
      p_cart: cart.map((item) => ({ product_id: item.id, qty: item.qty })),
      p_discount: disc,
      p_amount_paid: Number(paid),
      p_payment_method: method,
    });
    setSaving(false);
    if (error) {
      const message = error.message?.includes("checkout_sale")
        ? "The secure checkout function is not installed. Run the updated supabase/schema.sql in Supabase SQL Editor, then try again."
        : error.message;
      return alert(message);
    }

    const sale = data;
    const patient = patients.find((p) => String(p.id) === String(patientId));
    setReceipt({
      id: sale.sale_id,
      date: sale.created_at,
      patient: patient?.full_name,
      items: sale.items || cart,
      subtotal: sale.subtotal,
      disc: sale.discount,
      total: sale.total,
      paid: sale.amount_paid,
      change: sale.change_amount,
      method,
    });
    setCart([]); setPaid(""); setDiscount(""); setPatientId("");
    loadData();
  }

  const shown = products.filter((p) =>
    (cat === "All" || p.category === cat)
    && (!lowStockOnly || (p.category !== "Service" && Number(p.stock) <= 5))
    && p.name.toLowerCase().includes(search.toLowerCase()));
  const productTotalPages = Math.max(1, Math.ceil(shown.length / pageSize));
  const currentProductPage = Math.min(productPage, productTotalPages);
  const pagedProducts = shown.slice((currentProductPage - 1) * pageSize, currentProductPage * pageSize);
  useEffect(() => { setProductPage(1); }, [search, cat]);
  const cartTotalPages = Math.max(1, Math.ceil(cart.length / pageSize));
  const currentCartPage = Math.min(cartPage, cartTotalPages);
  const pagedCart = cart.slice((currentCartPage - 1) * pageSize, currentCartPage * pageSize);
  useEffect(() => { setCartPage(1); }, [cart.length]);

  if (receipt) {
    return (
      <div className="card receipt">
        <h3 style={{ textAlign: "center" }}>{CLINIC_NAME}</h3>
        <p className="muted" style={{ textAlign: "center" }}>Official Receipt #{receipt.id}<br />{dateTime(receipt.date)}</p>
        {receipt.patient && <p>Patient: <b>{receipt.patient}</b></p>}
        <hr />
        {receipt.items.map((i) => (
          <div key={i.id} className="cart-line"><span>{i.name} x{i.qty}</span><span>{peso(i.price * i.qty)}</span></div>
        ))}
        <hr />
        <div className="cart-line"><span>Subtotal</span><span>{peso(receipt.subtotal)}</span></div>
        {receipt.disc > 0 && <div className="cart-line"><span>Discount</span><span>-{peso(receipt.disc)}</span></div>}
        <div className="cart-line"><b>Total</b><b>{peso(receipt.total)}</b></div>
        <div className="cart-line"><span>Paid ({receipt.method})</span><span>{peso(receipt.paid)}</span></div>
        <div className="cart-line"><b>Change</b><b>{peso(receipt.change)}</b></div>
        <p className="muted" style={{ textAlign: "center" }}>Thank you!</p>
        <button className="btn" onClick={() => window.print()}>Print</button>{" "}
        <button className="btn primary" onClick={() => setReceipt(null)}>New sale</button>
      </div>
    );
  }

  return (
    <div>
      <h1>POS / Cashier</h1>
      <div className="pos-layout pos-layout-empty">
        <div className="card">
          <div className="pos-sale-header">
            <h3>Current sale</h3>
            <button className="btn primary" type="button" onClick={() => setCatalogOpen(true)}>
              <Plus size={16} /> Add items
            </button>
          </div>
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">Walk-in customer</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>

          {cart.length === 0 && <p className="muted">No items added to this sale yet.</p>}
          {pagedCart.map((c) => (
            <div key={c.id} className="cart-line">
              <span>{c.name}<br /><small className="muted">{peso(c.price)}</small></span>
              <span className="qty">
                <button className="btn small" onClick={() => changeQty(c, -1)}><Minus size={12} /></button>
                <b>{c.qty}</b>
                <button className="btn small" onClick={() => changeQty(c, 1)}><Plus size={12} /></button>
                <button className="btn small danger" onClick={() => changeQty(c, -c.qty)}><Trash2 size={12} /></button>
              </span>
            </div>
          ))}
          <Pagination page={cartPage} setPage={setCartPage} totalItems={cart.length} pageSize={pageSize} />

          <hr />
          <div className="cart-line"><span>Subtotal</span><span>{peso(subtotal)}</span></div>
          <label className="cart-line">Discount (₱)<input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} style={{ width: 110 }} /></label>
          <div className="total"><span>TOTAL</span><span>{peso(total)}</span></div>

          <div className="chips" role="group" aria-label="Payment method">
            {["Cash", "GCash", "Card"].map((m) => (
              <button
                key={m}
                type="button"
                className={method === m ? "chip active" : "chip"}
                aria-pressed={method === m}
                onClick={() => setMethod(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <input type="number" placeholder="Amount paid" value={paid} onChange={(e) => setPaid(e.target.value)} />
          <div className="chips">
            <button type="button" className="chip" onClick={() => setPaid(total)}>Exact</button>
            {[100, 500, 1000].map((n) => <button type="button" key={n} className="chip" onClick={() => setPaid(n)}>₱{n}</button>)}
          </div>
          <div className="cart-line"><span>Change</span><b>{paid && change >= 0 ? peso(change) : peso(0)}</b></div>
          <button className="btn pay" onClick={checkout} disabled={saving}>
            {saving ? "Processing..." : "Pay & Save Sale"}
          </button>
          <ActionLoadingDialog open={saving} title="Processing sale" description="Validating stock and recording payment..." />
        </div>
      </div>
      <Modal title={lowStockOnly ? "Low stock items" : "Add items to sale"} open={catalogOpen} onClose={() => setCatalogOpen(false)} className="pos-catalog-modal">
        <div className="toolbar">
          <div className="chips">
            {["All", "Medicine", "Service"].map((c) => (
              <button key={c} type="button" className={!lowStockOnly && cat === c ? "chip active" : "chip"} onClick={() => { setCat(c); setLowStockOnly(false); }}>{c}</button>
            ))}
            <button type="button" className={lowStockOnly ? "chip active" : "chip"} onClick={() => setLowStockOnly(true)}>Low stock</button>
          </div>
          <div className="search"><Search size={16} /><input placeholder="Search item..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
        <div className="grid pos-catalog-grid">
          {pagedProducts.map((p) => {
            const out = tracksStock(p) && p.stock < 1;
            const selected = cart.some((item) => item.id === p.id);
            return (
              <label key={p.id} className={`item pos-catalog-item${selected ? " selected" : ""}${out ? " disabled" : ""}`}>
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={out}
                  onChange={() => toggleProductSelection(p)}
                />
                <span className="pos-catalog-item-details">
                  <b>{p.name}</b>
                  <span className="price">{peso(p.price)}</span>
                  <small>{selected ? "Selected" : tracksStock(p) ? (out ? "Out of stock" : p.stock + " in stock") : "Service"}</small>
                </span>
              </label>
            );
          })}
        </div>
        {shown.length === 0
          ? <p className="muted">No products or services found.</p>
          : <Pagination page={productPage} setPage={setProductPage} totalItems={shown.length} pageSize={pageSize} />}
        <div className="modal-actions">
          <button type="button" className="btn primary" onClick={() => setCatalogOpen(false)}>Done</button>
        </div>
      </Modal>
    </div>
  );
}
