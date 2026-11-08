import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "../supabaseClient";
import { CLINIC_NAME } from "../lib/format";
import {
  LayoutDashboard, ShoppingCart, Users, CalendarDays, Package, Receipt,
  UserCog, LogOut, Stethoscope, Moon, Sun, PanelLeftClose, PanelLeftOpen
} from "lucide-react";

const ALL_PAGES = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "pos", label: "POS / Cashier", icon: ShoppingCart },
  { id: "patients", label: "Patients", icon: Users },
  { id: "appointments", label: "Appointments", icon: CalendarDays },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "sales", label: "Sales History", icon: Receipt },
  { id: "staff", label: "Staff & Roles", icon: UserCog },
];

// Which pages each role can open
const ACCESS = {
  admin: ["dashboard", "pos", "patients", "appointments", "inventory", "sales", "staff"],
  doctor: ["dashboard", "patients", "appointments", "inventory"],
  cashier: ["dashboard", "pos", "sales"],
};

export default function Sidebar({ page, setPage, role, email }) {
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("clinic-theme") === "dark");
  const visiblePages = ALL_PAGES.filter((item) => ACCESS[role].includes(item.id));

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("clinic-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <motion.aside
      className={`sidebar${collapsed ? " collapsed" : ""}`}
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
      </div>
      <nav>
        <div className="nav-section-label">Workspace</div>
        {visiblePages.map((item) => (
          <motion.button
            key={item.id}
            type="button"
            title={collapsed ? item.label : undefined}
            className={page === item.id ? "nav active" : "nav"}
            onClick={() => setPage(item.id)}
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
            onClick={() => setDark((value) => !value)}
            whileTap={{ scale: 0.96 }}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
            {!collapsed && <span>{dark ? "Light mode" : "Dark mode"}</span>}
          </motion.button>
          <motion.button
            className="nav logout"
            type="button"
            title="Log out"
            onClick={() => supabase.auth.signOut()}
            whileTap={{ scale: 0.96 }}
          >
            <LogOut size={18} />
            {!collapsed && <span>Log out</span>}
          </motion.button>
        </div>
      </div>
    </motion.aside>
  );
}
