// Login page for staff and doctors.
import { useState } from "react";
import { supabase } from "../supabaseClient";
import { CLINIC_NAME } from "../lib/format";
import { Stethoscope } from "lucide-react";
import ActionLoadingDialog from "../components/ActionLoadingDialog";

function handleAppLink(event, navigate) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate?.();
}

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
      <form className="card login" onSubmit={handleLogin}>
        <div className="login-brand"><span className="brand-mark"><Stethoscope size={21} /></span></div>
        <h2>{CLINIC_NAME}</h2>
        <p className="muted">Clinic Management System</p>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="btn primary" type="submit" disabled={loggingIn}>{loggingIn ? "Logging in..." : "Log in"}</button>
        <a className="btn" href="/book-appointment" onClick={(event) => handleAppLink(event, onBookAppointment)}>Book an Appointment</a>
        <a className="btn" href="/prices" onClick={(event) => handleAppLink(event, onViewPrices)}>View Medicines & Services</a>
        {message && <p className="error">{message}</p>}
      </form>
      <ActionLoadingDialog open={loggingIn} title="Signing in" description="Verifying your clinic account..." />
    </div>
  );
}
