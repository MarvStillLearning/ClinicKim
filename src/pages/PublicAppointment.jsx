import { useState } from "react";
import { supabase } from "../supabaseClient";
import { CLINIC_NAME } from "../lib/format";
import { Stethoscope } from "lucide-react";

export default function PublicAppointment({ onBack }) {
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    appt_at: "",
    reason: "",
    doctor: "",
  });
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bookingCode, setBookingCode] = useState("");

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const selectedTime = new Date(form.appt_at);
    if (selectedTime <= new Date()) {
      setMessage("Please select a future date and time.");
      setSaving(false);
      return;
    }

    const { data, error } = await supabase.rpc("book_appointment", {
      p_full_name: form.full_name.trim(),
      p_phone: form.phone.trim(),
      p_appt_at: selectedTime.toISOString(),
      p_reason: form.reason.trim(),
      p_doctor: form.doctor.trim(),
    });

    if (error?.message?.includes("Could not find the function")) {
      setMessage("Online booking is not configured yet. The clinic administrator must run supabase/public-booking.sql in Supabase SQL Editor.");
    } else if (error) {
      setMessage(error.message);
    }
    else {
      setBookingCode(data?.booking_code || "");
      setSuccess(true);
    }
    setSaving(false);
  }

  return (
    <div className="public-booking">
      <form className="card public-booking-card" onSubmit={submit}>
        <div className="public-booking-header">
          <Stethoscope size={36} color="#0d9488" />
          <h2>{CLINIC_NAME}</h2>
          <p className="muted">Patient Appointment Booking</p>
        </div>

        {success ? (
          <div className="public-success">
            <h3>Appointment submitted</h3>
            {bookingCode && (
              <div className="booking-confirmation">
                <small className="muted">Your Booking ID</small>
                <h2>{bookingCode}</h2>
                <p>Present or quote this ID when contacting or visiting the clinic.</p>
              </div>
            )}
            <p className="muted">Your appointment is now marked as Scheduled. Please wait for clinic confirmation.</p>
            {bookingCode && <button className="btn" type="button" onClick={() => window.print()}>Print Confirmation</button>}
            <button className="btn primary" type="button" onClick={onBack}>Back to Login</button>
          </div>
        ) : (
          <>
            <label>Full Name
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </label>
            <label>Phone Number
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </label>
            <label>Date & Time
              <input type="datetime-local" value={form.appt_at} onChange={(e) => setForm({ ...form, appt_at: e.target.value })} required />
            </label>
            <label>Reason for Visit
              <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
            </label>
            <label>Preferred Doctor (optional)
              <input value={form.doctor} onChange={(e) => setForm({ ...form, doctor: e.target.value })} />
            </label>
            {message && <p className="error">{message}</p>}
            <button className="btn primary" type="submit" disabled={saving}>{saving ? "Submitting..." : "Submit Appointment"}</button>
            <button className="btn" type="button" onClick={onBack}>Back to Login</button>
          </>
        )}
      </form>
    </div>
  );
}
