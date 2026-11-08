// Login page for staff and doctors.
import { useState } from "react";
import { supabase } from "../supabaseClient";
import { CLINIC_NAME } from "../lib/format";
import { Stethoscope } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";

export default function Login({ onBookAppointment, onViewPrices }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
  }

  return (
    <div className="login-bg">
      <ThemeToggle className="login-theme-toggle" />
      <form className="card login" onSubmit={handleLogin}>
        <div className="login-brand"><span className="brand-mark"><Stethoscope size={21} /></span></div>
        <h2>{CLINIC_NAME}</h2>
        <p className="muted">Clinic Management System</p>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="btn primary" type="submit">Log in</button>
        <button className="btn" type="button" onClick={onBookAppointment}>Book an Appointment</button>
        <button className="btn" type="button" onClick={onViewPrices}>View Medicines & Services</button>
        {message && <p className="error">{message}</p>}
      </form>
    </div>
  );
}
