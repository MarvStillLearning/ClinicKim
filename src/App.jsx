// Main file: checks who is logged in, then shows the sidebar and the chosen page.
import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import Sidebar from "./components/Sidebar.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import POS from "./pages/POS.jsx";
import Patients from "./pages/Patients.jsx";
import Clinical from "./pages/Clinical.jsx";
import Appointments from "./pages/Appointments.jsx";
import Inventory from "./pages/Inventory.jsx";
import Sales from "./pages/Sales.jsx";
import Staff from "./pages/Staff.jsx";
import AuditLogs from "./pages/AuditLogs.jsx";
import PublicAppointment from "./pages/PublicAppointment.jsx";
import PublicPrices from "./pages/PublicPrices.jsx";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("cashier"); // admin, doctor, or cashier
  const [page, setPage] = useState("dashboard");
  const [appointmentsFilter, setAppointmentsFilter] = useState("Upcoming");
  const [loading, setLoading] = useState(true);
  const [publicPage, setPublicPage] = useState(null);
  const reducedMotion = useReducedMotion();

  const accessByRole = {
    admin: ["dashboard", "pos", "patients", "consultations", "appointments", "inventory", "sales", "staff", "audit"],
    doctor: ["dashboard", "patients", "consultations", "appointments", "inventory"],
    cashier: ["dashboard", "pos", "sales"],
  };

  // Check if someone is already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Get the user's role from the profiles table
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("role").eq("id", user.id).single()
      .then(({ data }) => setRole(data?.role || "cashier"));
  }, [user]);

  if (loading) return (
    <div className="center" role="status" aria-live="polite">
      <div className="loading-state">Loading workspace...</div>
    </div>
  );
  if (!user && publicPage === "appointment") {
    return <PublicAppointment onBack={() => setPublicPage(null)} />;
  }
  if (!user && publicPage === "prices") {
    return <PublicPrices onBack={() => setPublicPage(null)} />;
  }
  if (!user) return <Login onBookAppointment={() => setPublicPage("appointment")} onViewPrices={() => setPublicPage("prices")} />;
  const activePage = (accessByRole[role] || []).includes(page) ? page : "dashboard";

  return (
    <div className="layout">
      <Sidebar
        page={activePage}
        setPage={(nextPage) => {
          if (nextPage === "appointments") setAppointmentsFilter("Upcoming");
          setPage(nextPage);
        }}
        role={role}
        email={user.email}
      />
      <AnimatePresence mode="wait">
        <motion.main
          key={activePage}
          className="content"
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: reducedMotion ? 0 : 0.22, ease: "easeOut" }}
        >
          {activePage === "dashboard" && (
            <Dashboard onOpenAppointmentsToday={() => {
              setAppointmentsFilter("Today");
              setPage("appointments");
            }} />
          )}
          {activePage === "pos" && <POS user={user} />}
          {activePage === "patients" && <Patients />}
          {activePage === "consultations" && <Clinical user={user} />}
          {activePage === "appointments" && <Appointments initialFilter={appointmentsFilter} />}
          {activePage === "inventory" && <Inventory />}
          {activePage === "sales" && <Sales />}
          {activePage === "staff" && <Staff />}
          {activePage === "audit" && <AuditLogs />}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
