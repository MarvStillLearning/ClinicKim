// Sales history: click a sale to see the items.
import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { peso, dateTime, appointmentDateKey, appointmentDateBoundary, nextAppointmentDateKey, startOfAppointmentWeek } from "../lib/format";
import Pagination from "../components/Pagination";

export default function Sales({ initialFilter = "Today" }) {
  const [sales, setSales] = useState([]);
  const [filter, setFilter] = useState(initialFilter);
  const [selectedDate, setSelectedDate] = useState("");
  const [openId, setOpenId] = useState(null);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 10;

  useEffect(() => {
    let active = true;
    async function loadSales() {
      setLoading(true);
      let query = supabase.from("sales").select("*, patients(full_name)").order("created_at", { ascending: false });
      if (selectedDate) {
        query = query
          .gte("created_at", appointmentDateBoundary(selectedDate))
          .lt("created_at", appointmentDateBoundary(nextAppointmentDateKey(selectedDate)));
      } else {
        query = query.limit(1000);
      }
      const { data, error } = await query;
      if (!active) return;
      if (error) {
        alert(error.message);
        setSales([]);
      } else {
        setSales(data || []);
      }
      setLoading(false);
    }
    loadSales();
    return () => { active = false; };
  }, [selectedDate]);

  async function toggle(id) {
    if (openId === id) return setOpenId(null);
    const { data } = await supabase.from("sale_items").select("*").eq("sale_id", id);
    setItems(data || []);
    setOpenId(id);
  }

  const today = appointmentDateKey(new Date());
  const weekStart = startOfAppointmentWeek(today);
  const monthStart = `${today.slice(0, 7)}-01`;
  const shown = sales.filter((sale) => {
    const date = appointmentDateKey(sale.created_at);
    if (selectedDate) return date === selectedDate;
    if (filter === "All") return true;
    if (filter === "Today") return date === today;
    if (filter === "This week") return date >= weekStart && date <= today;
    if (filter === "This month") return date >= monthStart && date <= today;
    return false;
  });
  const sum = shown.reduce((t, s) => t + Number(s.total), 0);
  const totalPages = Math.max(1, Math.ceil(shown.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedShown = shown.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => { setPage(1); }, [filter, selectedDate]);

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
        <div className="stat"><div><small>{selectedDate ? `Sales on ${selectedDate}` : filter === "All" ? "Total (up to 1,000)" : filter === "Today" ? "Today's sales" : `${filter} sales`}</small><h2>{peso(sum)}</h2></div></div>
        <div className="stat"><div><small>Transactions</small><h2>{shown.length}</h2></div></div>
      </div>
      <div className="card">
        <div className="toolbar">
          <div className="chips">
            {["Today", "This week", "This month", "All"].map((f) => (
              <button
                type="button"
                key={f}
                className={!selectedDate && filter === f ? "chip active" : "chip"}
                onClick={() => { setSelectedDate(""); setFilter(f); }}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="sales-history-actions">
            <label className="sales-date-filter">Specific date<input type="date" value={selectedDate} max={today} onChange={(event) => setSelectedDate(event.target.value)} /></label>
            <button className="btn" type="button" onClick={exportCsv}>Export CSV</button>
          </div>
        </div>
        {loading ? <p className="muted">Loading sales...</p> : shown.length === 0 ? <p className="muted">No sales found for this period.</p> : <div className="table-wrap"><table>
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
        </table></div>}
        {!loading && <Pagination page={page} setPage={setPage} totalItems={shown.length} pageSize={pageSize} />}
      </div>
    </div>
  );
}
