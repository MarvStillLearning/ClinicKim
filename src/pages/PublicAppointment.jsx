import { useState } from "react";
import { supabase } from "../supabaseClient";
import { CLINIC_NAME } from "../lib/format";
import { Stethoscope } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import ActionLoadingDialog from "../components/ActionLoadingDialog";
import Modal from "../components/Modal";

export default function PublicAppointment({ onBack }) {
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    appt_at: "",
    reason: "",
    doctor: "Monique Nolasco - Pet",
    location: "",
  });
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bookingCode, setBookingCode] = useState("");
  const [notificationSent, setNotificationSent] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

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

    setShowConfirmation(true);
    setSaving(false);
  }

  async function confirmBooking() {
    setSaving(true);
    setMessage("");
    const selectedTime = new Date(form.appt_at);
    const { data, error } = await supabase.functions.invoke("public-appointment", {
      body: {
        p_full_name: form.full_name.trim(),
        p_phone: form.phone.trim(),
        p_appt_at: selectedTime.toISOString(),
        p_reason: form.reason.trim(),
        p_doctor: form.doctor.trim(),
        p_location: form.location,
      },
    });

    if (error) {
      let errorMessage = error.message;
      if (error.context instanceof Response) {
        try {
          const responseBody = await error.context.json();
          if (typeof responseBody?.error === "string") errorMessage = responseBody.error;
        } catch {
          errorMessage = error.message;
        }
      }
      if (errorMessage.includes("public-appointment")) {
        errorMessage = "Online booking notifications are not configured. Please contact the clinic.";
      }
      setMessage(errorMessage);
    } else if (data?.error) {
      setMessage(data.error);
    }
    else {
      setBookingCode(data?.booking_code || "");
      setNotificationSent(Boolean(data?.notification_sent));
      setSuccess(true);
    }
    setShowConfirmation(false);
    setSaving(false);
  }

  return (
    <div className="public-booking">
      <ThemeToggle className="public-theme-toggle" />
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
            {!notificationSent && <p className="error">Your booking was saved, but the clinic email notification could not be sent. Please contact the clinic to confirm.</p>}
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
            <label>Location
              <select value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required>
                <option value="">Select location...</option>
                <option value="Sta. Ana, Cagayan">Sta. Ana, Cagayan</option>
                <option value="Gattaran, Cagayan">Gattaran, Cagayan</option>
              </select>
            </label>
            <label>Doctor
              <select value={form.doctor} onChange={(e) => setForm({ ...form, doctor: e.target.value })} required>
                <option value="Monique Nolasco - Pet">Monique Nolasco - Pet</option>
              </select>
            </label>
            {message && <p className="error">{message}</p>}
            <button className="btn primary" type="submit" disabled={saving}>{saving ? "Submitting..." : "Submit Appointment"}</button>
            <button className="btn" type="button" onClick={onBack}>Back to Login</button>
          </>
        )}
      </form>
      <Modal title="Confirm appointment details" open={showConfirmation} onClose={() => setShowConfirmation(false)} className="staff-modal">
        <div className="patient-confirmation">
          <p>Please check that the patient and clinic details are correct before booking.</p>
          <h3>{form.full_name}</h3>
          <p><b>Phone:</b> {form.phone}</p>
          <p><b>Date & Time:</b> {new Date(form.appt_at).toLocaleString()}</p>
          <p><b>Location:</b> {form.location}</p>
          <p><b>Doctor:</b> {form.doctor}</p>
          <p><b>Reason:</b> {form.reason}</p>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setShowConfirmation(false)}>Cancel</button>
            <button type="button" className="btn primary" onClick={confirmBooking}>Confirm & Book</button>
          </div>
        </div>
      </Modal>
      <ActionLoadingDialog open={saving} title="Submitting appointment" description="Creating your clinic booking..." />
    </div>
  );
}
