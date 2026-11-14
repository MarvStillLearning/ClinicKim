import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { appointmentDateKey, appointmentDateLabel, appointmentDateTimeTimestamp, CLINIC_NAME } from "../lib/format";
import AppointmentAvailabilityPicker from "../components/AppointmentAvailabilityPicker";
import { Stethoscope } from "lucide-react";
import ActionLoadingDialog from "../components/ActionLoadingDialog";
import Modal from "../components/Modal";
import ThemeToggle from "../components/ThemeToggle";

function timeLabel(value) {
  const date = /^\d{2}:\d{2}$/.test(value) ? new Date(`1970-01-01T${value}+08:00`) : new Date(value);
  return date.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
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

function handleAppLink(event, navigate) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate?.();
}

export default function PublicAppointment({ onBack }) {
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    reason: "",
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
  const [availableDates, setAvailableDates] = useState([]);
  const [availableDoctors, setAvailableDoctors] = useState([]);
  const [availableTimes, setAvailableTimes] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [datesLoading, setDatesLoading] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const availabilityLocation = mode === "create" ? form.location : changeForm?.location || "";

  function dateKey(value) {
    return appointmentDateKey(value);
  }

  useEffect(() => {
    let active = true;
    setAvailableDates([]);
    setAvailableDoctors([]);
    setAvailableTimes([]);
    setSelectedDate("");
    setSelectedDoctor("");
    setSelectedTime("");
    if (!availabilityLocation) {
      setDatesLoading(false);
      return () => { active = false; };
    }

    setDatesLoading(true);
    supabase.rpc("get_public_appointment_dates", { p_location: availabilityLocation })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setMessage(error.message);
        else setAvailableDates((data || []).map((item) => item.available_date));
        setDatesLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Unable to load available appointment dates.");
        setDatesLoading(false);
      });
    return () => { active = false; };
  }, [availabilityLocation]);

  useEffect(() => {
    let active = true;
    setAvailableDoctors([]);
    setSelectedDoctor("");
    if (!selectedDate || !availabilityLocation) {
      setAvailabilityLoading(false);
      return () => { active = false; };
    }
    setAvailabilityLoading(true);
    supabase.rpc("get_public_appointment_doctors", {
      p_date: selectedDate,
      p_location: availabilityLocation,
    }).then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage(error.message);
      else setAvailableDoctors((data || []).map((item) => item.doctor));
      setAvailabilityLoading(false);
    }).catch((error) => {
      if (!active) return;
      setMessage(error instanceof Error ? error.message : "Unable to load available doctors.");
      setAvailabilityLoading(false);
    });
    return () => { active = false; };
  }, [selectedDate, availabilityLocation]);

  useEffect(() => {
    let active = true;
    setAvailableTimes([]);
    if (!selectedDate || !selectedDoctor || !availabilityLocation) return () => { active = false; };
    setAvailabilityLoading(true);
    supabase.rpc("get_public_appointment_slots", {
      p_date: selectedDate,
      p_location: availabilityLocation,
      p_doctor: selectedDoctor,
    }).then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage(error.message);
      else setAvailableTimes((data || []).map((item) => ({
        ...item,
        available_time: String(item.available_time).slice(0, 5),
      })));
      setAvailabilityLoading(false);
    }).catch((error) => {
      if (!active) return;
      setMessage(error instanceof Error ? error.message : "Unable to load available times.");
      setAvailabilityLoading(false);
    });
    return () => { active = false; };
  }, [selectedDate, selectedDoctor, availabilityLocation]);

  const selectedAppointmentAt = selectedDate && selectedTime
    ? appointmentDateTimeTimestamp(`${selectedDate}T${selectedTime}`)
    : "";
  const offeredDates = [...new Set([
    ...availableDates,
    ...(mode === "change" && existingAppointment ? [dateKey(existingAppointment.appt_at)] : []),
  ])].sort();

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    if (!selectedAppointmentAt || !selectedDoctor || selectedTime < "08:00" || selectedTime >= "16:00") {
      setMessage("Choose an available appointment date and time.");
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
      const data = await invokeBookingFunction({
        action: updating ? "update" : "create",
        ...(updating ? {
          p_booking_code: lookup.booking_code.trim(),
          p_phone: lookup.phone.trim(),
        } : {
          p_full_name: form.full_name.trim(),
          p_phone: form.phone.trim(),
        }),
        p_appt_at: selectedAppointmentAt,
        p_reason: values.reason.trim(),
        p_doctor: selectedDoctor,
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
      if (!data || typeof data !== "object" || typeof data.appt_at !== "string" || Number.isNaN(Date.parse(data.appt_at))) {
        throw new Error("Could not load this appointment. Please verify the booking ID and phone number, then try again.");
      }
      setExistingAppointment(data);
      setChangeForm({
        reason: data.reason || "",
        location: data.location || "",
      });
      setSelectedDate("");
      setSelectedDoctor("");
      setSelectedTime("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to find that appointment.");
    } finally {
      setSaving(false);
    }
  }

  function submitChange(e) {
    e.preventDefault();
    if (!selectedAppointmentAt || !selectedDoctor || selectedTime < "08:00" || selectedTime >= "16:00") {
      setMessage("Choose an available appointment date and time.");
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
    setSelectedDate("");
    setSelectedDoctor("");
    setSelectedTime("");
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
          <p><b>Date & time:</b> {selectedAppointmentAt ? `${appointmentDateLabel(selectedAppointmentAt)} · ${timeLabel(selectedTime)}` : "-"}</p>
          <p><b>Location:</b> {form.location}</p>
          <p><b>Doctor:</b> {selectedDoctor || "-"}</p>
          <p><b>Reason:</b> {form.reason}</p>
        </>
      );
    }
    if (!changeForm || !existingAppointment) return null;
    return (
      <>
        <p>Please confirm the updated appointment details.</p>
        <h3>{existingAppointment?.booking_code}</h3>
        <p><b>Date & time:</b> {selectedAppointmentAt ? `${appointmentDateLabel(selectedAppointmentAt)} · ${timeLabel(selectedTime)}` : "-"}</p>
        <p><b>Location:</b> {changeForm.location}</p>
        <p><b>Doctor:</b> {selectedDoctor || "-"}</p>
        <p><b>Reason:</b> {changeForm.reason}</p>
      </>
    );
  }

  return (
    <div className="public-booking">
      <ThemeToggle className="public-theme-toggle" />
      <form className="card public-booking-card" onSubmit={submitForm}>
        <div className="public-booking-header">
          <Stethoscope size={36} color="var(--primary)" />
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
            <a className="btn primary" href="/login" onClick={(event) => handleAppLink(event, onBack)}>Back to Login</a>
          </div>
        ) : mode === "create" ? (
          <>
            <label>Full Name
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </label>
            <label>Phone Number
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </label>
            <label>Reason for Visit
              <textarea maxLength={500} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
            </label>
            <label>Location
              <select value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required>
                <option value="">Select location...</option>
                <option value="Sta. Ana, Cagayan">Sta. Ana, Cagayan</option>
                <option value="Gattaran, Cagayan">Gattaran, Cagayan</option>
              </select>
            </label>
            {form.location && (datesLoading
              ? <p className="muted">Loading available dates...</p>
              : availableDates.length === 0
                ? <p className="muted">No appointment dates are available at this location. Please contact the clinic.</p>
                : <AppointmentAvailabilityPicker
                    dates={availableDates}
                    doctors={availableDoctors}
                    times={availableTimes}
                    selectedDate={selectedDate}
                    selectedDoctor={selectedDoctor}
                    selectedTime={selectedTime}
                    loading={availabilityLoading}
                    onDateChange={(date) => { setSelectedDate(date); setSelectedDoctor(""); setSelectedTime(""); }}
                    onDoctorChange={setSelectedDoctor}
                    onTimeChange={setSelectedTime}
                  />
            )}
            {message && <p className="error">{message}</p>}
            <button className="btn primary" type="submit" disabled={saving}>{saving ? "Submitting..." : "Submit Appointment"}</button>
            <button className="btn" type="button" onClick={() => startMode("change")}>Change an existing appointment</button>
            <a className="btn" href="/login" onClick={(event) => handleAppLink(event, onBack)}>Back to Login</a>
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
                  <p><b>Date & time:</b> {appointmentDateLabel(existingAppointment.appt_at)} · {timeLabel(existingAppointment.appt_at)}</p>
                  <p><b>Location:</b> {existingAppointment.location}</p>
                  <p><b>Doctor:</b> {existingAppointment.doctor}</p>
                  <p><b>Reason:</b> {existingAppointment.reason}</p>
                </div>
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
                  {datesLoading
                    ? <p className="muted">Loading available dates...</p>
                    : offeredDates.length === 0
                    ? <p className="muted">No available appointment dates at this location. Please choose another location.</p>
                    : <AppointmentAvailabilityPicker
                        dates={offeredDates}
                        doctors={availableDoctors}
                        times={availableTimes}
                        selectedDate={selectedDate}
                        selectedDoctor={selectedDoctor}
                        selectedTime={selectedTime}
                        loading={availabilityLoading}
                        onDateChange={(date) => { setSelectedDate(date); setSelectedDoctor(""); setSelectedTime(""); }}
                        onDoctorChange={setSelectedDoctor}
                        onTimeChange={setSelectedTime}
                      />}
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
            <a className="btn" href="/login" onClick={(event) => handleAppLink(event, onBack)}>Back to Login</a>
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
