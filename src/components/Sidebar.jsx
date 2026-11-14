import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "../supabaseClient";
import { CLINIC_NAME } from "../lib/format";
import {
  LayoutDashboard, ShoppingCart, Users, CalendarDays, Package, Receipt,
  UserCog, LogOut, Stethoscope, Moon, Sun, PanelLeftClose, PanelLeftOpen, ShieldCheck, Menu, X
} from "lucide-react";
import ActionLoadingDialog from "./ActionLoadingDialog";

const ALL_PAGES = [
  { id: "dashboard", label: "Dashboard", group: "OVERVIEW", icon: LayoutDashboard },
  { id: "patients", label: "Patients", group: "CLINICAL", icon: Users },
  { id: "consultations", label: "Consultations", group: "CLINICAL", icon: Stethoscope },
  { id: "appointments", label: "Appointments", group: "CLINICAL", icon: CalendarDays },
  { id: "pos", label: "Medical POS", group: "PHARMACY & POS", icon: ShoppingCart },
  { id: "inventory", label: "Inventory", group: "PHARMACY & POS", icon: Package },
  { id: "sales", label: "Sales Transactions", group: "PHARMACY & POS", icon: Receipt },
  { id: "staff", label: "Doctors & Staff", group: "ADMINISTRATION", icon: UserCog },
  { id: "audit", label: "Audit Log", group: "ADMINISTRATION", icon: ShieldCheck },
];

// Which pages each role can open
const ACCESS = {
  admin: ["dashboard", "pos", "patients", "consultations", "appointments", "inventory", "sales", "staff", "audit"],
  doctor: ["dashboard", "patients", "consultations", "appointments", "inventory"],
  cashier: ["dashboard", "pos", "sales"],
};

export default function Sidebar({ page, setPage, role, email }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark");
  const [loggingOut, setLoggingOut] = useState(false);
  const visiblePages = ALL_PAGES.filter((item) => ACCESS[role].includes(item.id));

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  return (
    <>
    <motion.aside
      className={`sidebar${collapsed ? " collapsed" : ""}${mobileMenuOpen ? " mobile-open" : ""}`}
      animate={{ width: collapsed ? 84 : 248 }}
      transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="brand">
        <span className="brand-mark"><Stethoscope size={19} /></span>
        {!collapsed && <span className="brand-name">{CLINIC_NAME}</span>}
        <button
          className="sidebar-collapse"
          type="button"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
        <button
          className="mobile-menu-toggle"
          type="button"
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="primary-navigation"
          onClick={() => {
            setCollapsed(false);
            setMobileMenuOpen((open) => !open);
          }}
        >
          {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>
      <nav id="primary-navigation">
        {["OVERVIEW", "CLINICAL", "PHARMACY & POS", "ADMINISTRATION"].map((group) => {
          const items = visiblePages.filter((item) => item.group === group);
          if (!items.length) return null;
          return (
            <div className="nav-group" key={group}>
              {!collapsed && <div className="nav-section-label">{group}</div>}
              {items.map((item) => (
                <motion.button
                  key={item.id}
                  type="button"
                  title={item.label}
                  aria-label={item.label}
                  className={page === item.id ? "nav active" : "nav"}
                  onClick={() => {
                    setPage(item.id);
                    setMobileMenuOpen(false);
                  }}
                  whileHover={{ x: collapsed ? 0 : 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {page === item.id && (
                    <motion.span
                      className="nav-active-indicator"
                      layoutId="sidebar-active-item"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <item.icon size={18} />
                  {!collapsed && <span>{item.label}</span>}
                </motion.button>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="user-box">
        {!collapsed && (
          <div className="user-box-main">
            <small className="user-email">{email}</small>
            <span className="badge">{role}</span>
          </div>
        )}
        <div className="sidebar-tools">
          <motion.button
            className="nav"
            type="button"
            title={dark ? "Use light mode" : "Use dark mode"}
            aria-label={dark ? "Use light mode" : "Use dark mode"}
            onClick={() => setDark((value) => {
              const next = !value;
              localStorage.setItem("clinic-theme", next ? "dark" : "light");
              return next;
            })}
            whileTap={{ scale: 0.96 }}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
            {!collapsed && <span>{dark ? "Light mode" : "Dark mode"}</span>}
          </motion.button>
          <motion.button
            className="nav logout"
            type="button"
            title="Log out"
            onClick={async () => {
              setLoggingOut(true);
              await supabase.auth.signOut();
            }}
            whileTap={{ scale: 0.96 }}
          >
            <LogOut size={18} />
            {!collapsed && <span>Log out</span>}
          </motion.button>
        </div>
      </div>
    </motion.aside>
    <ActionLoadingDialog open={loggingOut} title="Signing out" description="Closing your secure session..." />
    </>
  );
}
