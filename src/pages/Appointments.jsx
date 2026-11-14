// Appointments: schedule visits and mark them Done or Cancelled.
import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { appointmentDateKey, appointmentDateTime, appointmentDateTimeLocal, appointmentDateTimeTimestamp } from "../lib/format";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import ActionLoadingDialog from "../components/ActionLoadingDialog";
import AppointmentAvailabilityPicker from "../components/AppointmentAvailabilityPicker";
import DebouncedSearchInput from "../components/DebouncedSearchInput";

const emptyAppointment = { patient_id: "", appt_at: "", reason: "", doctor: "Monique Nolasco - Pet", location: "" };

export default function Appointments({ initialFilter = "Upcoming", canManageSchedule = false, onManageSchedule }) {
  const [appts, setAppts] = useState([]);
  const [patients, setPatients] = useState([]);
  const [filter, setFilter] = useState(initialFilter);
  const [form, setForm] = useState(emptyAppointment);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [actionType, setActionType] = useState("save");
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [availableDates, setAvailableDates] = useState([]);
  const [availableDoctors, setAvailableDoctors] = useState([]);
  const [availableTimes, setAvailableTimes] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [datesLoading, setDatesLoading] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const pageSize = 5;

  async function load() {
    const a = await supabase.from("appointments").select("*, patients(full_name, phone)").order("appt_at");
    const p = await supabase.from("patients").select("*").order("full_name");
    setAppts(a.data || []);
    setPatients(p.data || []);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    let active = true;
    setAvailableDates([]);
    setAvailableDoctors([]);
    setAvailableTimes([]);
    setSelectedDate("");
    setSelectedDoctor("");
    setSelectedTime("");
    setAvailabilityError("");

    if (!showForm || form.id || !form.location) {
      setDatesLoading(false);
      return () => { active = false; };
    }

    setDatesLoading(true);
    supabase.rpc("get_public_appointment_dates", { p_location: form.location })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setAvailabilityError(error.message);
        else setAvailableDates((data || []).map((item) => item.available_date));
        setDatesLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        setAvailabilityError(error instanceof Error ? error.message : "Unable to load available dates.");
        setDatesLoading(false);
      });

    return () => { active = false; };
  }, [form.location, form.id, showForm]);

  useEffect(() => {
    let active = true;
    setAvailableDoctors([]);
    setSelectedDoctor("");

    if (!showForm || form.id || !selectedDate || !form.location) {
      setAvailabilityLoading(false);
      return () => { active = false; };
    }

    setAvailabilityLoading(true);
    supabase.rpc("get_public_appointment_doctors", {
      p_date: selectedDate,
      p_location: form.location,
    }).then(({ data, error }) => {
      if (!active) return;
      if (error) setAvailabilityError(error.message);
      else setAvailableDoctors((data || []).map((item) => item.doctor));
      setAvailabilityLoading(false);
    }).catch((error) => {
      if (!active) return;
      setAvailabilityError(error instanceof Error ? error.message : "Unable to load available doctors.");
      setAvailabilityLoading(false);
    });

    return () => { active = false; };
  }, [selectedDate, form.location, form.id, showForm]);

  useEffect(() => {
    let active = true;
    setAvailableTimes([]);
    if (!showForm || form.id || !selectedDate || !selectedDoctor || !form.location) return () => { active = false; };
    setAvailabilityLoading(true);
    supabase.rpc("get_public_appointment_slots", {
      p_date: selectedDate,
      p_location: form.location,
      p_doctor: selectedDoctor,
    }).then(({ data, error }) => {
      if (!active) return;
      if (error) setAvailabilityError(error.message);
      else setAvailableTimes((data || []).map((item) => ({
        ...item,
        available_time: String(item.available_time).slice(0, 5),
      })));
      setAvailabilityLoading(false);
    }).catch((error) => {
      if (!active) return;
      setAvailabilityError(error instanceof Error ? error.message : "Unable to load available times.");
      setAvailabilityLoading(false);
    });
    return () => { active = false; };
  }, [selectedDate, selectedDoctor, form.location, form.id, showForm]);

  async function save(e) {
    e.preventDefault();
    if (!form.patient_id) {
      setPatientSearch("");
      setShowPatientPicker(true);
      return;
    }
    if (!form.id && (!selectedDate || !selectedDoctor || !selectedTime)) {
      setAvailabilityError("Choose an available date, doctor, and time.");
      return;
    }
    setSaving(true);
    setActionType("save");
    try {
      let error;
      if (form.id) {
        const data = { ...form, appt_at: appointmentDateTimeTimestamp(form.appt_at) };
        delete data.id;
        ({ error } = await supabase.from("appointments").update(data).eq("id", form.id));
      } else {
        ({ error } = await supabase.rpc("book_staff_appointment", {
          p_patient_id: Number(form.patient_id),
          p_appt_at: appointmentDateTimeTimestamp(`${selectedDate}T${selectedTime}`),
          p_reason: form.reason.trim(),
          p_doctor: selectedDoctor,
          p_location: form.location,
        }));
      }
      if (error) {
        alert(error.message);
        return;
      }
      setForm(emptyAppointment);
      setShowForm(false);
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to save the appointment.");
    } finally {
      setSaving(false);
    }
  }
  async function setStatus(id, status) {
    setSaving(true);
    setActionType(status === "Cancelled" ? "cancel" : "save");
    await supabase.from("appointments").update({ status }).eq("id", id);
    load();
    setSaving(false);
  }
  async function remove(a) {
    if (!window.confirm(`Delete the appointment for ${a.patients?.full_name || "this patient"}?`)) return;
    setSaving(true);
    setActionType("delete");
    const { error } = await supabase.from("appointments").delete().eq("id", a.id);
    if (error) {
      setSaving(false);
      return alert(error.message);
    }
    load();
    setSaving(false);
  }
  function openAdd() {
    setForm(emptyAppointment);
    setSelectedDate("");
    setSelectedDoctor("");
    setSelectedTime("");
    setAvailabilityError("");
    setShowPatientPicker(false);
    setShowForm(true);
  }
  function requestPatient(patientId) {
    if (!patientId) {
      setForm({ ...form, patient_id: "" });
      return;
    }
    setShowPatientPicker(false);
    setForm({ ...form, patient_id: patientId });
  }
  function openEdit(a) {
    setForm({ id: a.id, patient_id: a.patient_id || "", appt_at: appointmentDateTimeLocal(a.appt_at), reason: a.reason || "", doctor: a.doctor || "Monique Nolasco - Pet", location: a.location || "" });
    setAvailabilityError("");
    setShowForm(true);
  }

  const today = appointmentDateKey(new Date());
  const shown = appts.filter((a) => {
    const query = search.trim().toLowerCase();
    if (query) {
      const matches = [a.booking_code, a.patients?.full_name, a.reason, a.doctor, a.location].some((value) => String(value || "").toLowerCase().includes(query));
      if (!matches) return false;
    }
    if (filter === "All") return true;
    const date = appointmentDateKey(a.appt_at);
    if (filter === "Today") return date === today;
    return date >= today && a.status === "Scheduled";
  });
  const totalPages = Math.max(1, Math.ceil(shown.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedShown = shown.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => { setPage(1); }, [search, filter]);

  return (
    <div>
      <div className="page-header">
        <h1>Appointments</h1>
        {canManageSchedule && <button className="btn" type="button" onClick={onManageSchedule}>Manage doctor schedule</button>}
        <button className="btn primary" type="button" onClick={openAdd}>Add appointment</button>
      </div>

      <Modal title={form.id ? "Edit appointment" : "New appointment"} open={showForm} onClose={() => setShowForm(false)} className="form-modal">
        <form className="form-grid" onSubmit={save}>
          <label>Patient
            <button
              type="button"
              className="btn"
              onClick={() => {
                setPatientSearch("");
                setShowPatientPicker(true);
              }}
            >
              {form.patient_id
                ? patients.find((patient) => String(patient.id) === String(form.patient_id))?.full_name || "Change patient"
                : "Select patient"}
            </button>
          </label>
          <label>Reason<input maxLength={500} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required /></label>
          {form.id ? (
            <>
              <label>Date & time<input type="datetime-local" value={form.appt_at} onChange={(e) => setForm({ ...form, appt_at: e.target.value })} required /></label>
              <label>Doctor
                <select value={form.doctor} onChange={(e) => setForm({ ...form, doctor: e.target.value })} required>
                  <option value="Monique Nolasco - Pet">Monique Nolasco - Pet</option>
                </select>
              </label>
              <label>Location
                <select value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required>
                  <option value="">Select location...</option>
                  <option value="Sta. Ana, Cagayan">Sta. Ana, Cagayan</option>
                  <option value="Gattaran, Cagayan">Gattaran, Cagayan</option>
                </select>
              </label>
            </>
          ) : (
            <>
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
                  ? <p className="muted">No appointment dates are available at this location.</p>
                  : <AppointmentAvailabilityPicker
                      dates={availableDates}
                      doctors={availableDoctors}
                      times={availableTimes}
                      selectedDate={selectedDate}
                      selectedDoctor={selectedDoctor}
                      selectedTime={selectedTime}
                      loading={availabilityLoading}
                      onDateChange={(date) => {
                        setSelectedDate(date);
                        setSelectedDoctor("");
                        setSelectedTime("");
                      }}
                      onDoctorChange={setSelectedDoctor}
                      onTimeChange={setSelectedTime}
                    />
              )}
              {availabilityError && <p className="error" role="alert">{availabilityError}</p>}
            </>
          )}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn primary" disabled={saving}>{saving ? "Saving..." : form.id ? "Update appointment" : "Add appointment"}</button>
          </div>
        </form>
      </Modal>

      <Modal title="Select existing patient" open={showPatientPicker} onClose={() => setShowPatientPicker(false)} className="staff-modal">
        <div className="patient-picker">
          <DebouncedSearchInput
            className="search patient-picker-search-wrap"
            placeholder="Search name, phone, or address..."
            onSearch={setPatientSearch}
            resetKey={showPatientPicker}
          />
          <div className="patient-picker-list">
            {patients
              .filter((patient) => {
                const searchText = patientSearch.trim().toLowerCase();
                if (!searchText) return true;
                return [patient.full_name, patient.phone, patient.address]
                  .some((value) => String(value || "").toLowerCase().includes(searchText));
              })
              .map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  className="patient-picker-item"
                  onClick={() => requestPatient(patient.id)}
                >
                  <strong>{patient.full_name}</strong>
                  <span>{patient.phone || "No phone"} · {patient.address || "No address recorded"}</span>
                </button>
              ))}
          </div>
        </div>
      </Modal>

      <div className="card">
        <div className="search" style={{ marginBottom: 12 }}>
          <DebouncedSearchInput placeholder="Search patient, doctor, location, reason, or Booking ID..." onSearch={setSearch} />
        </div>
        <div className="chips">
          {["Upcoming", "Today", "All"].map((f) => (
            <button key={f} className={filter === f ? "chip active" : "chip"} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
        {shown.length === 0 && <p className="muted">No appointments.</p>}
        {shown.length > 0 && (
          <div className="table-wrap">
            <table className="appointments-table">
              <thead><tr><th>#</th><th>Booking ID</th><th>Patient / phone</th><th>Date & time</th><th>Doctor</th><th>Location</th><th>Reason</th><th>Status</th><th className="right">Actions</th></tr></thead>
              <tbody>
                {pagedShown.map((a, index) => (
                  <tr key={a.id}>
                    <td><b>{(currentPage - 1) * pageSize + index + 1}</b></td>
                    <td>{a.booking_code ? <span className="tag blue">{a.booking_code}</span> : "-"}</td>
                    <td>
                      <b>{a.patients?.full_name || "-"}</b>
                      <small className="appointment-patient-phone">{a.patients?.phone || "No phone recorded"}</small>
                    </td>
                    <td>{appointmentDateTime(a.appt_at)}</td>
                    <td>{a.doctor ? `Dr. ${a.doctor}` : "-"}</td>
                    <td>{a.location || "-"}</td>
                    <td>{a.reason || "-"}</td>
                    <td><span className={"tag " + (a.status === "Done" ? "green" : a.status === "Cancelled" ? "red" : "blue")}>{a.status}</span></td>
                    <td className="right">
                      <div className="appointment-actions">
                      {a.status === "Scheduled" && <>
                        <button className="btn small" type="button" onClick={() => setStatus(a.id, "Done")}>Done</button>
                        <button className="btn small" type="button" onClick={() => setStatus(a.id, "Cancelled")}>Cancel</button>
                      </>}
                      <button className="btn small" type="button" onClick={() => openEdit(a)}>Edit</button>
                      <button className="btn small danger" type="button" onClick={() => remove(a)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} setPage={setPage} totalItems={shown.length} pageSize={pageSize} />
      </div>
      <ActionLoadingDialog
        open={saving}
        title={actionType === "delete" ? "Deleting appointment" : actionType === "cancel" ? "Cancelling appointment" : form.id ? "Saving appointment changes" : "Creating appointment"}
        description={actionType === "delete" || actionType === "cancel" ? "Updating the appointment schedule..." : "Saving schedule, patient, and doctor details..."}
        danger={actionType === "delete" || actionType === "cancel"}
      />
    </div>
  );
}
