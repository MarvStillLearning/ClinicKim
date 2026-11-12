// Home page: today's numbers and 7-day sales chart.
import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { supabase } from "../supabaseClient";
import { peso, appointmentDateKey, appointmentDateBoundary, appointmentDateLabel, nextAppointmentDateKey, shiftAppointmentDateKey, startOfAppointmentWeek } from "../lib/format";
import { Wallet, CalendarDays, Stethoscope, AlertTriangle, Users } from "lucide-react";

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

export default function Dashboard({
  onOpenSales,
  onOpenPatients,
  onOpenAppointmentsToday,
  onOpenConsultationsToday,
  onOpenLowStock,
}) {
  const [sales, setSales] = useState([]);
  const [patientCount, setPatientCount] = useState(null);
  const [patientCountError, setPatientCountError] = useState("");
  const [lowStock, setLowStock] = useState([]);
  const [appts, setAppts] = useState([]);
  const [consultationsToday, setConsultationsToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    async function load() {
      const todayKey = appointmentDateKey(new Date());
      const tomorrowKey = nextAppointmentDateKey(todayKey);
      const monthStartKey = `${todayKey.slice(0, 7)}-01`;

      const [salesResult, lowStockResult, appointmentsResult, consultationsResult, patientsResult] = await Promise.all([
        supabase.from("sales").select("id, total, created_at")
          .gte("created_at", appointmentDateBoundary(monthStartKey))
          .order("created_at", { ascending: false }),
        supabase.from("products").select("*").neq("category", "Service").lte("stock", 5).order("stock"),
        supabase.from("appointments").select("*, patients(full_name)")
          .gte("appt_at", appointmentDateBoundary(todayKey))
          .lt("appt_at", appointmentDateBoundary(tomorrowKey))
          .order("appt_at"),
        supabase.from("records").select("id", { count: "exact", head: true })
          .gte("created_at", appointmentDateBoundary(todayKey))
          .lt("created_at", appointmentDateBoundary(tomorrowKey)),
        supabase.from("patients").select("id", { count: "exact", head: true }),
      ]);
      setSales(salesResult.data || []);
      setLowStock(lowStockResult.data || []);
      setAppts(appointmentsResult.data || []);
      setConsultationsToday(consultationsResult.count || 0);
      setPatientCount(patientsResult.error ? null : patientsResult.count ?? 0);
      setPatientCountError(patientsResult.error?.message || "");
      setLoading(false);
    }
    load();
  }, []);

  const todayKey = appointmentDateKey(new Date());
  const weekStartKey = startOfAppointmentWeek(todayKey);
  const monthStartKey = `${todayKey.slice(0, 7)}-01`;
  const salesToday = sales.filter((sale) => appointmentDateKey(sale.created_at) === todayKey);
  const salesThisWeek = sales.filter((sale) => {
    const date = appointmentDateKey(sale.created_at);
    return date >= weekStartKey && date <= todayKey;
  });
  const salesThisMonth = sales.filter((sale) => appointmentDateKey(sale.created_at) >= monthStartKey);
  const totalFor = (items) => items.reduce((sum, sale) => sum + Number(sale.total), 0);

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const dateKey = shiftAppointmentDateKey(todayKey, -i);
    const date = new Date(`${dateKey}T12:00:00+08:00`);
    const total = totalFor(sales.filter((sale) => appointmentDateKey(sale.created_at) === dateKey));
    days.push({ label: date.toLocaleDateString("en-PH", { weekday: "short", timeZone: "Asia/Manila" }), total });
  }
  const max = Math.max(...days.map((d) => d.total), 1);
  const todayLabel = appointmentDateLabel(new Date());
  const stats = [
    {
      icon: Users,
      label: "Registered patients",
      value: patientCount ?? 0,
      format: (number) => patientCountError ? "Unavailable" : number.toLocaleString("en-PH"),
      onClick: onOpenPatients,
    },
    { icon: Wallet, label: "Sales today", value: totalFor(salesToday), format: (number) => peso(number), onClick: () => onOpenSales?.("Today") },
    { icon: Wallet, label: "Sales this week", value: totalFor(salesThisWeek), format: (number) => peso(number), onClick: () => onOpenSales?.("This week") },
    { icon: Wallet, label: "Sales this month", value: totalFor(salesThisMonth), format: (number) => peso(number), onClick: () => onOpenSales?.("This month") },
    { icon: CalendarDays, label: "Appointments today", value: appts.length, format: (number) => String(number), onClick: onOpenAppointmentsToday },
    { icon: Stethoscope, label: "Consultations today", value: consultationsToday, format: (number) => String(number), onClick: onOpenConsultationsToday },
    { icon: AlertTriangle, label: "Low stock items", value: lowStock.length, format: (number) => String(number), className: "warn", onClick: onOpenLowStock },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">{todayLabel}</p>
        </div>
      </div>
      {loading ? (
        <div className="stats dashboard-stats" aria-label="Loading dashboard">
          {[1, 2, 3, 4, 5, 6, 7].map((item) => <div className="stat skeleton-stat" key={item}><span className="skeleton-line" /><span className="skeleton-line short" /></div>)}
        </div>
      ) : (
      <div className="stats dashboard-stats">
        {stats.map((stat, index) => (
          <motion.button
            type="button"
            className={`stat dashboard-stat ${stat.className || ""}`}
            key={stat.label}
            onClick={stat.onClick}
            disabled={!stat.onClick}
            title={stat.label === "Registered patients" ? patientCountError || undefined : undefined}
            initial={reducedMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.28, delay: reducedMotion ? 0 : index * 0.06 }}
            whileHover={{ y: -3 }}
          >
            <stat.icon />
            <div><small>{stat.label}</small><h2><CountUp value={stat.value} format={stat.format} /></h2></div>
          </motion.button>
        ))}
      </div>
      )}

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
    </div>
  );
}
