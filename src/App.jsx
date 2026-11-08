// Main file: checks who is logged in, then shows the sidebar and the chosen page.
import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import Sidebar from "./components/Sidebar.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import POS from "./pages/POS.jsx";
import Patients from "./pages/Patients.jsx";
import Appointments from "./pages/Appointments.jsx";
import Inventory from "./pages/Inventory.jsx";
import Sales from "./pages/Sales.jsx";
import Staff from "./pages/Staff.jsx";
import PublicAppointment from "./pages/PublicAppointment.jsx";
import PublicPrices from "./pages/PublicPrices.jsx";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("cashier"); // admin, doctor, or cashier
  const [page, setPage] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [publicPage, setPublicPage] = useState(null);
  const reducedMotion = useReducedMotion();

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

  return (
    <div className="layout">
      <Sidebar page={page} setPage={setPage} role={role} email={user.email} />
      <AnimatePresence mode="wait">
        <motion.main
          key={page}
          className="content"
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: reducedMotion ? 0 : 0.22, ease: "easeOut" }}
        >
          {page === "dashboard" && <Dashboard />}
          {page === "pos" && <POS user={user} />}
          {page === "patients" && <Patients />}
          {page === "appointments" && <Appointments />}
          {page === "inventory" && <Inventory />}
          {page === "sales" && <Sales />}
          {page === "staff" && <Staff />}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
