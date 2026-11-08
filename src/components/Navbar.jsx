import { supabase } from "../supabaseClient";

export default function Navbar({ page, setPage, role, email }) {
  const menu = {
    admin: ["dashboard", "appointments", "patients", "clinical", "laboratory", "inventory", "pos", "sales", "staff"],
    doctor: ["dashboard", "appointments", "patients", "clinical", "laboratory", "inventory"],
    nurse: ["dashboard", "appointments", "patients", "clinical", "laboratory"],
    cashier: ["dashboard", "pos", "sales", "patients"],
  };
  const names = { dashboard: "Dashboard", appointments: "Appointments", patients: "Patients", clinical: "Clinical", laboratory: "Laboratory", inventory: "Inventory", pos: "POS / Billing", sales: "Sales", staff: "Staff" };
  const allowed = menu[role] || menu.cashier;

  return <nav className="navbar"><div className="brand"><span className="brand-mark">M</span><b>MediCare Clinic</b></div><div className="nav-links">{allowed.map((p) => <button key={p} className={page === p ? "active" : ""} onClick={() => setPage(p)}>{names[p]}</button>)}</div><span className="spacer"/><div className="user-menu"><small>{email}</small><span className="role-badge">{role}</span><button className="logout" onClick={() => supabase.auth.signOut()}>Log out</button></div></nav>;
}
