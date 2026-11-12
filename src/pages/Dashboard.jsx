// Home page: today's numbers, 7-day sales chart, low stock, today's appointments.
import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { supabase } from "../supabaseClient";
import { peso, appointmentDateKey, appointmentDateBoundary, appointmentDateTime, appointmentDateLabel, nextAppointmentDateKey, startOfToday } from "../lib/format";
import { Wallet, Users, AlertTriangle, CalendarDays } from "lucide-react";

function CountUp({ value, format = (number) => String(number) }) {
  const [shown, setShown] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const duration = 450;
    function update(now) {
      const progress = Math.min((now - start) / duration, 1);
      setShown(Math.round(value * progress));
      if (progress < 1) frame = requestAnimationFrame(update);
    }
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [value, reducedMotion]);

  return format(shown);
}

export default function Dashboard({ onOpenAppointmentsToday }) {
  const [sales, setSales] = useState([]);       // last 7 days
  const [patientCount, setPatientCount] = useState(0);
  const [lowStock, setLowStock] = useState([]);
  const [appts, setAppts] = useState([]);
  const [loading, setLoading] = useState(true);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    async function load() {
      const today = startOfToday();
      const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 6);
      const todayKey = appointmentDateKey(new Date());
      const tomorrowKey = nextAppointmentDateKey(todayKey);

      const s = await supabase.from("sales").select("*").gte("created_at", weekAgo.toISOString()).order("created_at", { ascending: false });
      const p = await supabase.from("patients").select("id", { count: "exact", head: true });
      const l = await supabase.from("products").select("*").neq("category", "Service").lte("stock", 5).order("stock");
      const a = await supabase.from("appointments").select("*, patients(full_name)")
        .gte("appt_at", appointmentDateBoundary(todayKey))
        .lt("appt_at", appointmentDateBoundary(tomorrowKey))
        .order("appt_at");
      setSales(s.data || []);
      setPatientCount(p.count || 0);
      setLowStock(l.data || []);
      setAppts(a.data || []);
      setLoading(false);
    }
    load();
  }, []);

  // Total sales for each of the last 7 days
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startOfToday()); d.setDate(d.getDate() - i);
    const total = sales.filter((s) => new Date(s.created_at).toDateString() === d.toDateString())
      .reduce((sum, s) => sum + Number(s.total), 0);
    days.push({ label: d.toLocaleDateString("en-PH", { weekday: "short" }), total });
  }
  const max = Math.max(...days.map((d) => d.total), 1);
  const todayTotal = days[6].total;
  const todayLabel = appointmentDateLabel(new Date());

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">{todayLabel}</p>
        </div>
      </div>
      {loading ? (
        <div className="stats" aria-label="Loading dashboard">
          {[1, 2, 3, 4].map((item) => <div className="stat skeleton-stat" key={item}><span className="skeleton-line" /><span className="skeleton-line short" /></div>)}
        </div>
      ) : (
      <div className="stats">
        {[
          { icon: Wallet, label: "Sales today", value: todayTotal, format: (number) => peso(number), className: "" },
          { icon: Users, label: "Total patients", value: patientCount, format: (number) => String(number), className: "" },
          { icon: CalendarDays, label: "Appointments today", value: appts.length, format: (number) => String(number), className: "" },
          { icon: AlertTriangle, label: "Low stock items", value: lowStock.length, format: (number) => String(number), className: "warn" },
        ].map((stat, index) => (
          <motion.div
            className={`stat ${stat.className}`}
            key={stat.label}
            role={stat.label === "Appointments today" ? "button" : undefined}
            tabIndex={stat.label === "Appointments today" ? 0 : undefined}
            onClick={stat.label === "Appointments today" ? onOpenAppointmentsToday : undefined}
            onKeyDown={stat.label === "Appointments today" ? (event) => {
              if (event.key === "Enter" || event.key === " ") onOpenAppointmentsToday?.();
            } : undefined}
            initial={reducedMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.28, delay: reducedMotion ? 0 : index * 0.06 }}
            whileHover={{ y: -3 }}
          >
            <stat.icon />
            <div><small>{stat.label}</small><h2><CountUp value={stat.value} format={stat.format} /></h2></div>
          </motion.div>
        ))}
      </div>
      )}

      <div className="dashboard-grid">
        <div className="card dashboard-sales">
          <h3>Sales - last 7 days</h3>
          <div className="chart">
            {days.map((d, index) => (
              <div key={d.label + d.total} className="bar-wrap">
                <small>{d.total ? peso(d.total).replace(".00", "") : ""}</small>
                <motion.div
                  className="bar"
                  initial={reducedMotion ? false : { height: 4 }}
                  animate={{ height: (d.total / max) * 140 + 4 }}
                  transition={{ duration: reducedMotion ? 0 : 0.38, delay: reducedMotion ? 0 : 0.08 + index * 0.05 }}
                />
                <small>{d.label}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="card dashboard-appointments">
          <h3>Today's appointments</h3>
          {appts.length === 0 && <p className="muted">No appointments today.</p>}
          {appts.slice(0, 6).map((a) => (
            <div
              key={a.id}
              className="list-row dashboard-list-link"
              role="button"
              tabIndex={0}
              onClick={onOpenAppointmentsToday}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onOpenAppointmentsToday?.();
              }}
            >
              <span><b>{a.patients?.full_name}</b><br /><small>{a.reason}</small></span>
              <span className="muted">{appointmentDateTime(a.appt_at)}</span>
            </div>
          ))}
          <h3 style={{ marginTop: 20 }}>Low stock</h3>
          {lowStock.length === 0 && <p className="muted">All items have enough stock.</p>}
          {lowStock.slice(0, 5).map((p) => (
            <div key={p.id} className="list-row"><span>{p.name}</span><span className="tag red">{p.stock} left</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}
