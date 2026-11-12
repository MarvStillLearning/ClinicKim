import { useState } from "react";
import { supabase } from "../supabaseClient";
import { CLINIC_NAME } from "../lib/format";
import { Stethoscope } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import ActionLoadingDialog from "../components/ActionLoadingDialog";
import Modal from "../components/Modal";

function localDateTime(value) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

async function invokeBookingFunction(body) {
  const { data, error } = await supabase.functions.invoke("public-appointment", { body });
  if (error) {
    let message = error.message;
    if (error.context instanceof Response) {
      try {
        const responseBody = await error.context.json();
        if (typeof responseBody?.error === "string") message = responseBody.error;
      } catch {
        message = error.message;
      }
    }
    if (message.includes("public-appointment")) {
      message = "Online booking is unavailable. Please contact the clinic.";
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

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
  const [mode, setMode] = useState("create");
  const [lookup, setLookup] = useState({ booking_code: "", phone: "" });
  const [existingAppointment, setExistingAppointment] = useState(null);
  const [changeForm, setChangeForm] = useState(null);

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
    try {
      const updating = mode === "change";
      const values = updating ? changeForm : form;
      const selectedTime = new Date(values.appt_at);
      const data = await invokeBookingFunction({
        action: updating ? "update" : "create",
        ...(updating ? {
          p_booking_code: lookup.booking_code.trim(),
          p_phone: lookup.phone.trim(),
        } : {
          p_full_name: form.full_name.trim(),
          p_phone: form.phone.trim(),
        }),
        p_appt_at: selectedTime.toISOString(),
        p_reason: values.reason.trim(),
        p_doctor: values.doctor.trim(),
        p_location: values.location,
      });
      setBookingCode(data?.booking_code || "");
      setNotificationSent(Boolean(data?.notification_sent));
      setSuccess(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save the appointment.");
    } finally {
      setShowConfirmation(false);
      setSaving(false);
    }
  }

  async function findExistingAppointment(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const data = await invokeBookingFunction({
        action: "lookup",
        p_booking_code: lookup.booking_code.trim(),
        p_phone: lookup.phone.trim(),
      });
      setExistingAppointment(data);
      setChangeForm({
        appt_at: localDateTime(data.appt_at),
        reason: data.reason || "",
        doctor: data.doctor || "Monique Nolasco - Pet",
        location: data.location || "",
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to find that appointment.");
    } finally {
      setSaving(false);
    }
  }

  function submitChange(e) {
    e.preventDefault();
    if (new Date(changeForm.appt_at) <= new Date()) {
      setMessage("Please select a future date and time.");
      return;
    }
    setMessage("");
    setShowConfirmation(true);
  }

  function startMode(nextMode) {
    setMode(nextMode);
    setMessage("");
    setExistingAppointment(null);
    setChangeForm(null);
  }

  const submitForm = mode === "create" ? submit : existingAppointment ? submitChange : findExistingAppointment;
  const submitLabel = mode === "create"
    ? "Submit Appointment"
    : existingAppointment ? "Review appointment changes" : "Find Booking";

  function confirmDetails() {
    if (mode === "create") {
      return (
        <>
          <p>Please check that the patient and clinic details are correct before booking.</p>
          <h3>{form.full_name}</h3>
          <p><b>Phone:</b> {form.phone}</p>
          <p><b>Date & Time:</b> {new Date(form.appt_at).toLocaleString()}</p>
          <p><b>Location:</b> {form.location}</p>
          <p><b>Doctor:</b> {form.doctor}</p>
          <p><b>Reason:</b> {form.reason}</p>
        </>
      );
    }
    return (
      <>
        <p>Please confirm the updated appointment details.</p>
        <h3>{existingAppointment?.booking_code}</h3>
        <p><b>Date & Time:</b> {new Date(changeForm.appt_at).toLocaleString()}</p>
        <p><b>Location:</b> {changeForm.location}</p>
        <p><b>Doctor:</b> {changeForm.doctor}</p>
        <p><b>Reason:</b> {changeForm.reason}</p>
      </>
    );
  }

  return (
    <div className="public-booking">
      <ThemeToggle className="public-theme-toggle" />
      <form className="card public-booking-card" onSubmit={submitForm}>
        <div className="public-booking-header">
          <Stethoscope size={36} color="#0d9488" />
          <h2>{CLINIC_NAME}</h2>
          <p className="muted">{mode === "create" ? "Patient Appointment Booking" : "Change an Existing Appointment"}</p>
        </div>

        {success ? (
          <div className="public-success">
            <h3>{mode === "change" ? "Appointment updated" : "Appointment submitted"}</h3>
            {bookingCode && (
              <div className="booking-confirmation">
                <small className="muted">Your Booking ID</small>
                <h2>{bookingCode}</h2>
                <p>Present or quote this ID when contacting or visiting the clinic.</p>
              </div>
            )}
            <p className="muted">
              {mode === "change"
                ? "Your appointment details have been updated. Please wait for clinic confirmation."
                : "Your appointment is now marked as Scheduled. Please wait for clinic confirmation."}
            </p>
            {!notificationSent && <p className="error">Your booking was saved, but the clinic email notification could not be sent. Please contact the clinic to confirm.</p>}
            {bookingCode && <button className="btn" type="button" onClick={() => window.print()}>Print Confirmation</button>}
            <button className="btn primary" type="button" onClick={onBack}>Back to Login</button>
          </div>
        ) : mode === "create" ? (
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
            <button className="btn" type="button" onClick={() => startMode("change")}>Change an existing appointment</button>
            <button className="btn" type="button" onClick={onBack}>Back to Login</button>
          </>
        ) : (
          <>
            {!existingAppointment ? (
              <>
                <p className="muted">Enter the Booking ID and phone number used when the appointment was booked.</p>
                <label>Booking ID
                  <input value={lookup.booking_code} onChange={(e) => setLookup({ ...lookup, booking_code: e.target.value })} required />
                </label>
                <label>Booking phone number
                  <input type="tel" value={lookup.phone} onChange={(e) => setLookup({ ...lookup, phone: e.target.value })} required />
                </label>
              </>
            ) : (
              <>
                <div className="booking-confirmation">
                  <small className="muted">Current appointment · {existingAppointment.booking_code}</small>
                  <p><b>Date & Time:</b> {new Date(existingAppointment.appt_at).toLocaleString()}</p>
                  <p><b>Location:</b> {existingAppointment.location}</p>
                  <p><b>Doctor:</b> {existingAppointment.doctor}</p>
                  <p><b>Reason:</b> {existingAppointment.reason}</p>
                </div>
                <label>New Date & Time
                  <input type="datetime-local" value={changeForm.appt_at} onChange={(e) => setChangeForm({ ...changeForm, appt_at: e.target.value })} required />
                </label>
                <label>Reason for Visit
                  <textarea maxLength={500} value={changeForm.reason} onChange={(e) => setChangeForm({ ...changeForm, reason: e.target.value })} required />
                </label>
                <label>Location
                  <select value={changeForm.location} onChange={(e) => setChangeForm({ ...changeForm, location: e.target.value })} required>
                    <option value="">Select location...</option>
                    <option value="Sta. Ana, Cagayan">Sta. Ana, Cagayan</option>
                    <option value="Gattaran, Cagayan">Gattaran, Cagayan</option>
                  </select>
                </label>
                <label>Doctor
                  <select value={changeForm.doctor} onChange={(e) => setChangeForm({ ...changeForm, doctor: e.target.value })} required>
                    <option value="Monique Nolasco - Pet">Monique Nolasco - Pet</option>
                  </select>
                </label>
              </>
            )}
            {message && <p className="error">{message}</p>}
            <button className="btn primary" type="submit" disabled={saving || !lookup.booking_code || !lookup.phone}>
              {saving ? "Please wait..." : submitLabel}
            </button>
            {existingAppointment && (
              <button className="btn" type="button" onClick={() => {
                setExistingAppointment(null);
                setChangeForm(null);
                setMessage("");
              }}>Use a different Booking ID</button>
            )}
            <button className="btn" type="button" onClick={() => startMode("create")}>Book a new appointment</button>
            <button className="btn" type="button" onClick={onBack}>Back to Login</button>
          </>
        )}
      </form>
      <Modal title={mode === "change" ? "Confirm appointment changes" : "Confirm appointment details"} open={showConfirmation} onClose={() => setShowConfirmation(false)} className="staff-modal">
        <div className="patient-confirmation">
          {confirmDetails()}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setShowConfirmation(false)}>Cancel</button>
            <button type="button" className="btn primary" onClick={confirmBooking}>
              {mode === "change" ? "Confirm changes" : "Confirm & Book"}
            </button>
          </div>
        </div>
      </Modal>
      <ActionLoadingDialog
        open={saving}
        title={mode === "change" ? "Updating appointment" : "Submitting appointment"}
        description={mode === "change" ? "Verifying booking and saving appointment changes..." : "Creating your clinic booking..."}
      />
    </div>
  );
}
