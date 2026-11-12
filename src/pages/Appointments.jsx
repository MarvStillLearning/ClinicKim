// Appointments: schedule visits and mark them Done or Cancelled.
import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { appointmentDateKey, appointmentDateTime, appointmentDateTimeLocal, appointmentDateTimeTimestamp } from "../lib/format";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import ActionLoadingDialog from "../components/ActionLoadingDialog";
import DoctorScheduleManager from "../components/DoctorScheduleManager";

const emptyAppointment = { patient_id: "", appt_at: "", reason: "", doctor: "Monique Nolasco - Pet", location: "" };

export default function Appointments({ initialFilter = "Upcoming", isAdmin = false }) {
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
  const [showSchedule, setShowSchedule] = useState(false);
  const pageSize = 10;

  async function load() {
    const a = await supabase.from("appointments").select("*, patients(full_name)").order("appt_at");
    const p = await supabase.from("patients").select("*").order("full_name");
    setAppts(a.data || []);
    setPatients(p.data || []);
  }
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    if (!form.patient_id) {
      setPatientSearch("");
      setShowPatientPicker(true);
      return;
    }
    setSaving(true);
    setActionType("save");
    const data = { ...form, appt_at: appointmentDateTimeTimestamp(form.appt_at) };
    delete data.id;
    const { error } = form.id
      ? await supabase.from("appointments").update(data).eq("id", form.id)
      : await supabase.from("appointments").insert(data);
    if (error) {
      setSaving(false);
      return alert(error.message);
    }
    setForm(emptyAppointment);
    setShowForm(false);
    load();
    setSaving(false);
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
        {isAdmin && <button className="btn" type="button" onClick={() => setShowSchedule((value) => !value)}>{showSchedule ? "Hide doctor schedule" : "Manage doctor schedule"}</button>}
        <button className="btn primary" type="button" onClick={openAdd}>Add appointment</button>
      </div>

      {isAdmin && showSchedule && <DoctorScheduleManager />}

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
          <label>Date & time<input type="datetime-local" value={form.appt_at} onChange={(e) => setForm({ ...form, appt_at: e.target.value })} required /></label>
          <label>Reason<input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
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
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn primary" disabled={saving}>{saving ? "Saving..." : form.id ? "Update appointment" : "Add appointment"}</button>
          </div>
        </form>
      </Modal>

      <Modal title="Select existing patient" open={showPatientPicker} onClose={() => setShowPatientPicker(false)} className="staff-modal">
        <div className="patient-picker">
          <input
            className="patient-picker-search"
            type="search"
            placeholder="Search name, phone, or address..."
            value={patientSearch}
            onChange={(event) => setPatientSearch(event.target.value)}
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
          <input placeholder="Search patient, doctor, location, reason, or Booking ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="chips">
          {["Upcoming", "Today", "All"].map((f) => (
            <button key={f} className={filter === f ? "chip active" : "chip"} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
        {shown.length === 0 && <p className="muted">No appointments.</p>}
        {shown.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Booking ID</th><th>Patient</th><th>Date & time</th><th>Doctor</th><th>Location</th><th>Reason</th><th>Status</th><th className="right">Actions</th></tr></thead>
              <tbody>
                {pagedShown.map((a, index) => (
                  <tr key={a.id}>
                    <td><b>{(currentPage - 1) * pageSize + index + 1}</b></td>
                    <td>{a.booking_code ? <span className="tag blue">{a.booking_code}</span> : "-"}</td>
                    <td><b>{a.patients?.full_name || "-"}</b></td>
                    <td>{appointmentDateTime(a.appt_at)}</td>
                    <td>{a.doctor ? `Dr. ${a.doctor}` : "-"}</td>
                    <td>{a.location || "-"}</td>
                    <td>{a.reason || "-"}</td>
                    <td><span className={"tag " + (a.status === "Done" ? "green" : a.status === "Cancelled" ? "red" : "blue")}>{a.status}</span></td>
                    <td className="right">
                      {a.status === "Scheduled" && <>
                        <button className="btn small" type="button" onClick={() => setStatus(a.id, "Done")}>Done</button>{" "}
                        <button className="btn small" type="button" onClick={() => setStatus(a.id, "Cancelled")}>Cancel</button>{" "}
                      </>}
                      <button className="btn small" type="button" onClick={() => openEdit(a)}>Edit</button>{" "}
                      <button className="btn small danger" type="button" onClick={() => remove(a)}>Delete</button>
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
