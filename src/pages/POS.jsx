// Cashier: pick items, add discount, take payment, give change, print receipt.
import { memo, useCallback, useMemo, useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { peso, dateTime, CLINIC_NAME } from "../lib/format";
import { Plus, Minus, Trash2, Stethoscope, Printer } from "lucide-react";
import Pagination from "../components/Pagination";
import ActionLoadingDialog from "../components/ActionLoadingDialog";
import Modal from "../components/Modal";
import DebouncedSearchInput from "../components/DebouncedSearchInput";

const tracksStock = (item) => item.category !== "Service";

const POSProductCard = memo(function POSProductCard({ product, selected, onToggle }) {
  const outOfStock = tracksStock(product) && product.stock < 1;
  return (
    <label className={`item pos-catalog-item${selected ? " selected" : ""}${outOfStock ? " disabled" : ""}`}>
      <input type="checkbox" checked={selected} disabled={outOfStock} onChange={() => onToggle(product)} />
      <span className="pos-catalog-item-details">
        <b>{product.name}</b>
        <span className="price">{peso(product.price)}</span>
        <small>{selected ? "Selected" : tracksStock(product) ? (outOfStock ? "Out of stock" : `${product.stock} in stock`) : "Service"}</small>
      </span>
    </label>
  );
});

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
  const [patientPickerOpen, setPatientPickerOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const pageSize = 10;

  async function loadData() {
    const p = await supabase.from("products").select("*").in("category", ["Medicine", "Service"]).order("name");
    const pt = await supabase.from("patients").select("id, full_name, phone, address").order("full_name");
    setProducts(p.data || []);
    setPatients(pt.data || []);
  }
  useEffect(() => { loadData(); }, []);

  const toggleProductSelection = useCallback((product) => {
    if (tracksStock(product) && product.stock < 1) return;
    setCart((current) => current.some((item) => item.id === product.id)
      ? current.filter((item) => item.id !== product.id)
      : [...current, { ...product, qty: 1 }]);
  }, []);
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

  const shown = useMemo(() => products.filter((p) =>
    (cat === "All" || p.category === cat)
    && (!lowStockOnly || (p.category !== "Service" && Number(p.stock) <= 5))
    && p.name.toLowerCase().includes(search.toLowerCase())), [products, cat, lowStockOnly, search]);
  const productTotalPages = Math.max(1, Math.ceil(shown.length / pageSize));
  const currentProductPage = Math.min(productPage, productTotalPages);
  const pagedProducts = shown.slice((currentProductPage - 1) * pageSize, currentProductPage * pageSize);
  useEffect(() => { setProductPage(1); }, [search, cat]);
  const cartTotalPages = Math.max(1, Math.ceil(cart.length / pageSize));
  const currentCartPage = Math.min(cartPage, cartTotalPages);
  const pagedCart = cart.slice((currentCartPage - 1) * pageSize, currentCartPage * pageSize);
  const selectedPatient = patients.find((patient) => String(patient.id) === String(patientId));
  const matchingPatients = useMemo(() => patients.filter((patient) =>
    [patient.full_name, patient.phone, patient.address]
      .some((value) => String(value || "").toLowerCase().includes(patientSearch.trim().toLowerCase()))
  ), [patients, patientSearch]);
  useEffect(() => { setCartPage(1); }, [cart.length]);

  if (receipt) {
    return (
      <div className="receipt-page">
        <article className="card receipt">
          <header className="receipt-header">
            <div className="receipt-mark"><Stethoscope size={21} aria-hidden="true" /></div>
            <p className="receipt-eyebrow">OFFICIAL RECEIPT</p>
            <h1>{CLINIC_NAME}</h1>
            <p>Clinic payment receipt</p>
          </header>

          <section className="receipt-metadata" aria-label="Receipt information">
            <div><small>Receipt no.</small><strong>OR-{String(receipt.id).padStart(6, "0")}</strong></div>
            <div><small>Date issued</small><strong>{dateTime(receipt.date)}</strong></div>
          </section>

          <section className="receipt-patient">
            <small>RECEIVED FROM</small>
            <strong>{receipt.patient || "Walk-in patient"}</strong>
          </section>

          <table className="receipt-items">
            <thead><tr><th>Item / service</th><th>Qty</th><th>Amount</th></tr></thead>
            <tbody>
              {receipt.items.map((item) => (
                <tr key={item.id}>
                  <td><b>{item.name}</b><small>{peso(item.price)} each</small></td>
                  <td>{item.qty}</td>
                  <td>{peso(item.price * item.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <section className="receipt-totals" aria-label="Payment totals">
            <div><span>Subtotal</span><b>{peso(receipt.subtotal)}</b></div>
            {receipt.disc > 0 && <div><span>Discount</span><b>-{peso(receipt.disc)}</b></div>}
            <div className="receipt-grand-total"><span>Total paid</span><strong>{peso(receipt.total)}</strong></div>
          </section>

          <section className="receipt-payment" aria-label="Payment details">
            <div><span>Payment method</span><b>{receipt.method}</b></div>
            <div><span>Amount received</span><b>{peso(receipt.paid)}</b></div>
            <div><span>Change</span><b>{peso(receipt.change)}</b></div>
          </section>

          <footer className="receipt-footer">
            <strong>Thank you for choosing {CLINIC_NAME}.</strong>
            <span>Please keep this receipt for your records.</span>
          </footer>

          <div className="receipt-actions">
            <button className="btn" type="button" onClick={() => window.print()}><Printer size={16} /> Print receipt</button>
            <button className="btn primary" type="button" onClick={() => setReceipt(null)}><Plus size={16} /> New sale</button>
          </div>
        </article>
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
          <div className="pos-patient-select">
            <label>Patient</label>
            <button type="button" className="btn" onClick={() => {
              setPatientSearch("");
              setPatientPickerOpen(true);
            }}>
              {selectedPatient ? `${selectedPatient.full_name}${selectedPatient.phone ? ` | ${selectedPatient.phone}` : ""}` : "Walk-in customer - Select patient"}
            </button>
            {selectedPatient && <button type="button" className="btn small" onClick={() => setPatientId("")}>Clear patient</button>}
          </div>

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
          <DebouncedSearchInput placeholder="Search item..." onSearch={setSearch} />
        </div>
        <div className="grid pos-catalog-grid">
          {pagedProducts.map((product) => (
            <POSProductCard
              key={product.id}
              product={product}
              selected={cart.some((item) => item.id === product.id)}
              onToggle={toggleProductSelection}
          />
          ))}
        </div>
        {shown.length === 0
          ? <p className="muted">No products or services found.</p>
          : <Pagination page={productPage} setPage={setProductPage} totalItems={shown.length} pageSize={pageSize} />}
        <div className="modal-actions">
          <button type="button" className="btn primary" onClick={() => setCatalogOpen(false)}>Done</button>
        </div>
      </Modal>
      <Modal title="Select patient" open={patientPickerOpen} onClose={() => setPatientPickerOpen(false)} className="staff-modal">
        <div className="patient-picker">
          <DebouncedSearchInput
            className="search patient-picker-search-wrap"
            placeholder="Search name, phone, or address..."
            onSearch={setPatientSearch}
            resetKey={patientPickerOpen}
            inputProps={{ autoFocus: true }}
          />
          <div className="patient-picker-list">
            <button type="button" className="patient-picker-item" onClick={() => {
              setPatientId("");
              setPatientPickerOpen(false);
            }}>
              <strong>Walk-in customer</strong>
              <span>Sale without a patient profile</span>
            </button>
            {matchingPatients.map((patient) => (
              <button
                key={patient.id}
                type="button"
                className="patient-picker-item"
                onClick={() => {
                  setPatientId(String(patient.id));
                  setPatientPickerOpen(false);
                }}
              >
                <strong>{patient.full_name}</strong>
                <span>{patient.phone || "No phone"} | {patient.address || "No address recorded"}</span>
              </button>
            ))}
            {matchingPatients.length === 0 && <p className="muted">No matching patients found.</p>}
          </div>
        </div>
      </Modal>
    </div>
  );
}
