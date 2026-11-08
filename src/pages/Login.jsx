// Login page for staff and doctors.
import { useState } from "react";
import { supabase } from "../supabaseClient";
import { CLINIC_NAME } from "../lib/format";
import { Stethoscope } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import ActionLoadingDialog from "../components/ActionLoadingDialog";

export default function Login({ onBookAppointment, onViewPrices }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoggingIn(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    setLoggingIn(false);
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
        <button className="btn primary" type="submit" disabled={loggingIn}>{loggingIn ? "Logging in..." : "Log in"}</button>
        <button className="btn" type="button" onClick={onBookAppointment}>Book an Appointment</button>
        <button className="btn" type="button" onClick={onViewPrices}>View Medicines & Services</button>
        {message && <p className="error">{message}</p>}
      </form>
      <ActionLoadingDialog open={loggingIn} title="Signing in" description="Verifying your clinic account..." />
    </div>
  );
}
