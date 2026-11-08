// Sales history: click a sale to see the items.
import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { peso, dateTime, startOfToday } from "../lib/format";
import Pagination from "../components/Pagination";

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [filter, setFilter] = useState("Today");
  const [openId, setOpenId] = useState(null);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    supabase.from("sales").select("*, patients(full_name)").order("created_at", { ascending: false }).limit(300)
      .then(({ data }) => setSales(data || []));
  }, []);

  async function toggle(id) {
    if (openId === id) return setOpenId(null);
    const { data } = await supabase.from("sale_items").select("*").eq("sale_id", id);
    setItems(data || []);
    setOpenId(id);
  }

  const today = startOfToday().toDateString();
  const shown = sales.filter((s) => filter === "All" || new Date(s.created_at).toDateString() === today);
  const sum = shown.reduce((t, s) => t + Number(s.total), 0);
  const totalPages = Math.max(1, Math.ceil(shown.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedShown = shown.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => { setPage(1); }, [filter]);

  function exportCsv() {
    const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["Sale ID", "Date", "Patient", "Payment method", "Subtotal", "Discount", "Total"],
      ...shown.map((sale) => [
        sale.id,
        new Date(sale.created_at).toLocaleString("en-PH"),
        sale.patients?.full_name || "Walk-in",
        sale.payment_method,
        sale.subtotal || "",
        sale.discount || "",
        sale.total,
      ]),
    ];
    const csv = rows.map((row) => row.map(escape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `sales-${filter.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h1>Sales History</h1>
      <div className="stats">
        <div className="stat"><div><small>{filter === "Today" ? "Today's sales" : "Total (last 300)"}</small><h2>{peso(sum)}</h2></div></div>
        <div className="stat"><div><small>Transactions</small><h2>{shown.length}</h2></div></div>
      </div>
      <div className="card">
        <div className="toolbar">
          <div className="chips">
            {["Today", "All"].map((f) => <button key={f} className={filter === f ? "chip active" : "chip"} onClick={() => setFilter(f)}>{f}</button>)}
          </div>
          <button className="btn" type="button" onClick={exportCsv}>Export CSV</button>
        </div>
        <table>
          <thead><tr><th>#</th><th>Date</th><th>Patient</th><th>Method</th><th>Total</th></tr></thead>
          <tbody>
            {pagedShown.map((s, index) => (
              <>
                <tr key={s.id} className="clickable" onClick={() => toggle(s.id)}>
                  <td>{(currentPage - 1) * pageSize + index + 1}</td><td>{dateTime(s.created_at)}</td><td>{s.patients?.full_name || "Walk-in"}</td>
                  <td>{s.payment_method}</td><td><b>{peso(s.total)}</b></td>
                </tr>
                {openId === s.id && (
                  <tr key={s.id + "x"}><td colSpan="5" className="detail">
                    {items.map((i) => <div key={i.id}>{i.name} x{i.qty} - {peso(i.price * i.qty)}</div>)}
                    {Number(s.discount) > 0 && <div className="muted">Discount: {peso(s.discount)}</div>}
                  </td></tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        <Pagination page={page} setPage={setPage} totalItems={shown.length} pageSize={pageSize} />
      </div>
    </div>
  );
}
