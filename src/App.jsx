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
import DoctorScheduleManager from "./components/DoctorScheduleManager.jsx";
import Inventory from "./pages/Inventory.jsx";
import Sales from "./pages/Sales.jsx";
import Staff from "./pages/Staff.jsx";
import AuditLogs from "./pages/AuditLogs.jsx";
import Backup from "./pages/Backup.jsx";
import PublicAppointment from "./pages/PublicAppointment.jsx";
import PublicPrices from "./pages/PublicPrices.jsx";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const PAGE_IDS = new Set([
  "dashboard",
  "pos",
  "patients",
  "consultations",
  "appointments",
  "doctor-schedule",
  "inventory",
  "sales",
  "staff",
  "audit",
  "backup",
]);

function pageFromPathname(pathname) {
  const page = pathname.replace(/^\/+|\/+$/g, "");
  return PAGE_IDS.has(page) ? page : "dashboard";
}

function publicPageFromPathname(pathname) {
  const path = pathname.replace(/^\/+|\/+$/g, "");
  if (path === "book-appointment") return "appointment";
  if (path === "prices") return "prices";
  return null;
}

function pathForPublicPage(publicPage) {
  if (publicPage === "appointment") return "/book-appointment";
  if (publicPage === "prices") return "/prices";
  return "/login";
}

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("nurse"); // admin, doctor, or nurse
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [page, setPage] = useState(() => pageFromPathname(window.location.pathname));
  const [appointmentsFilter, setAppointmentsFilter] = useState("Upcoming");
  const [salesFilter, setSalesFilter] = useState("Today");
  const [consultationPatientId, setConsultationPatientId] = useState("");
  const [inventoryLowStockOnly, setInventoryLowStockOnly] = useState(false);
  const [posLowStockOnly, setPosLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publicPage, setPublicPage] = useState(() => publicPageFromPathname(window.location.pathname));
  const reducedMotion = useReducedMotion();

  // Keep this list in sync with the navigation menu in Sidebar.jsx.
  const accessByRole = {
    admin: [
      "dashboard",
      "pos",
      "patients",
      "consultations",
      "appointments",
      "doctor-schedule",
      "inventory",
      "sales",
      "staff",
      "audit",
      "backup",
    ],
    doctor: [
      "dashboard",
      "pos",
      "patients",
      "consultations",
      "appointments",
      "doctor-schedule",
      "inventory",
      "sales",
      "staff",
      "audit",
      "backup",
    ],
    nurse: [
      "dashboard",
      "pos",
      "patients",
      "consultations",
      "appointments",
      "doctor-schedule",
      "inventory",
      "sales",
    ],
  };

  // Clear page-specific filters when opening a page from the menu.
  function preparePage(nextPage) {
    if (nextPage === "appointments") setAppointmentsFilter("Upcoming");
    if (nextPage === "sales") setSalesFilter("Today");
    if (nextPage === "consultations") setConsultationPatientId("");
    if (nextPage === "inventory") setInventoryLowStockOnly(false);
    if (nextPage === "pos") setPosLowStockOnly(false);
  }

  function navigateToPage(nextPage) {
    preparePage(nextPage);
    setPage(nextPage);
    window.history.pushState({ page: nextPage }, "", `/${nextPage}`);
  }

  function navigateToPublicPage(nextPublicPage) {
    setPublicPage(nextPublicPage);
    window.history.pushState({ publicPage: nextPublicPage }, "", pathForPublicPage(nextPublicPage));
  }

  useEffect(() => {
    function handlePopState() {
      const nextPublicPage = publicPageFromPathname(window.location.pathname);
      setPublicPage(nextPublicPage);
      if (nextPublicPage || window.location.pathname === "/login" || window.location.pathname === "/") return;
      const nextPage = pageFromPathname(window.location.pathname);
      preparePage(nextPage);
      setPage(nextPage);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

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
    if (!user) {
      setRoleLoaded(false);
      return;
    }
    supabase.from("profiles").select("role").eq("id", user.id).single()
      .then(({ data }) => {
        setRole(data?.role || "nurse");
        setRoleLoaded(true);
      });
  }, [user]);

  const activePage = (accessByRole[role] || []).includes(page) ? page : "dashboard";

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const expectedPath = pathForPublicPage(publicPage);
      if (window.location.pathname !== expectedPath) {
        window.history.replaceState({ publicPage }, "", expectedPath);
      }
      return;
    }
  }, [loading, publicPage, user]);

  useEffect(() => {
    if (!user || !roleLoaded) return;
    const expectedPath = `/${activePage}`;
    if (window.location.pathname !== expectedPath) {
      window.history.replaceState({ page: activePage }, "", expectedPath);
    }
  }, [activePage, roleLoaded, user]);

  if (loading) return (
    <div className="center" role="status" aria-live="polite">
      <div className="loading-state">Loading workspace...</div>
    </div>
  );
  if (!user && publicPage === "appointment") {
    return <PublicAppointment onBack={() => navigateToPublicPage(null)} />;
  }
  if (!user && publicPage === "prices") {
    return <PublicPrices onBack={() => navigateToPublicPage(null)} />;
  }
  if (!user) {
    return (
      <Login
        onBookAppointment={() => navigateToPublicPage("appointment")}
        onViewPrices={() => navigateToPublicPage("prices")}
      />
    );
  }

  return (
    <div className="layout">
      <Sidebar
        page={activePage}
        setPage={navigateToPage}
        role={role}
        email={user.email}
      />
      <div className="app-content-shell">
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
              <Dashboard
                onOpenPatients={
                  accessByRole[role]?.includes("patients")
                    ? () => navigateToPage("patients")
                    : undefined
                }
                onOpenSales={(filter) => {
                  navigateToPage("sales");
                  setSalesFilter(filter);
                }}
                onOpenAppointmentsToday={() => {
                  navigateToPage("appointments");
                  setAppointmentsFilter("Today");
                }}
                onOpenConsultationsToday={() => {
                  setConsultationPatientId("");
                  navigateToPage("consultations");
                }}
                onOpenLowStock={() => {
                  navigateToPage("inventory");
                  setInventoryLowStockOnly(true);
                }}
              />
            )}
            {activePage === "pos" && (
              <POS user={user} initialLowStockOnly={posLowStockOnly} />
            )}
            {activePage === "patients" && <Patients />}
            {activePage === "consultations" && (
              <Clinical
                user={user}
                initialPatientId={consultationPatientId}
              />
            )}
            {activePage === "appointments" && (
              <Appointments
                initialFilter={appointmentsFilter}
                canManageSchedule={role === "admin" || role === "doctor" || role === "nurse"}
                onManageSchedule={() => navigateToPage("doctor-schedule")}
              />
            )}
            {activePage === "doctor-schedule" && ["admin", "doctor", "nurse"].includes(role) && (
              <DoctorScheduleManager onBack={() => navigateToPage("appointments")} />
            )}
            {activePage === "inventory" && (
              <Inventory initialLowStockOnly={inventoryLowStockOnly} />
            )}
            {activePage === "sales" && <Sales initialFilter={salesFilter} />}
            {activePage === "staff" && <Staff />}
            {activePage === "audit" && <AuditLogs />}
            {activePage === "backup" && <Backup role={role} />}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}
