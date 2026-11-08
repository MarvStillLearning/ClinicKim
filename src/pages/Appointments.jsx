// Appointments: schedule visits and mark them Done or Cancelled.
import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { dateTime, startOfToday } from "../lib/format";
import Modal from "../components/Modal";

const emptyAppointment = { patient_id: "", appt_at: "", reason: "", doctor: "" };

export default function Appointments() {
  const [appts, setAppts] = useState([]);
  const [patients, setPatients] = useState([]);
  const [filter, setFilter] = useState("Upcoming");
  const [form, setForm] = useState(emptyAppointment);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

  async function load() {
    const a = await supabase.from("appointments").select("*, patients(full_name)").order("appt_at");
    const p = await supabase.from("patients").select("id, full_name").order("full_name");
    setAppts(a.data || []);
    setPatients(p.data || []);
  }
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    const data = { ...form, appt_at: new Date(form.appt_at).toISOString() };
    delete data.id;
    const { error } = form.id
      ? await supabase.from("appointments").update(data).eq("id", form.id)
      : await supabase.from("appointments").insert(data);
    if (error) return alert(error.message);
    setForm(emptyAppointment);
    setShowForm(false);
    load();
  }
  async function setStatus(id, status) {
    await supabase.from("appointments").update({ status }).eq("id", id);
    load();
  }
  async function remove(a) {
    if (!window.confirm(`Delete the appointment for ${a.patients?.full_name || "this patient"}?`)) return;
    const { error } = await supabase.from("appointments").delete().eq("id", a.id);
    if (error) return alert(error.message);
    load();
  }
  function openAdd() {
    setForm(emptyAppointment);
    setShowForm(true);
  }
  function openEdit(a) {
    const date = new Date(a.appt_at);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setForm({ id: a.id, patient_id: a.patient_id || "", appt_at: local, reason: a.reason || "", doctor: a.doctor || "" });
    setShowForm(true);
  }

  const today = startOfToday();
  const shown = appts.filter((a) => {
    const query = search.trim().toLowerCase();
    if (query) {
      const matches = [a.booking_code, a.patients?.full_name, a.reason, a.doctor].some((value) => String(value || "").toLowerCase().includes(query));
      if (!matches) return false;
    }
    if (filter === "All") return true;
    if (filter === "Today") return new Date(a.appt_at).toDateString() === today.toDateString();
    return new Date(a.appt_at) >= today && a.status === "Scheduled";
  });

  return (
    <div>
      <div className="page-header">
        <h1>Appointments</h1>
        <button className="btn primary" type="button" onClick={openAdd}>Add appointment</button>
      </div>

      <Modal title={form.id ? "Edit appointment" : "New appointment"} open={showForm} onClose={() => setShowForm(false)} className="form-modal">
        <form className="form-grid" onSubmit={save}>
          <label>Patient
            <select value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })} required>
              <option value="">Select patient...</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </label>
          <label>Date & time<input type="datetime-local" value={form.appt_at} onChange={(e) => setForm({ ...form, appt_at: e.target.value })} required /></label>
          <label>Reason<input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
          <label>Doctor<input value={form.doctor} onChange={(e) => setForm({ ...form, doctor: e.target.value })} /></label>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn primary">{form.id ? "Update appointment" : "Add appointment"}</button>
          </div>
        </form>
      </Modal>

      <div className="card">
        <div className="search" style={{ marginBottom: 12 }}>
          <input placeholder="Search patient, doctor, reason, or Booking ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="chips">
          {["Upcoming", "Today", "All"].map((f) => (
            <button key={f} className={filter === f ? "chip active" : "chip"} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
        {shown.length === 0 && <p className="muted">No appointments.</p>}
        {shown.map((a) => (
          <div key={a.id} className="list-row">
            <span>
              {a.booking_code && <><b className="tag blue">{a.booking_code}</b><br /></>}
              <b>{a.patients?.full_name}</b> <small className="muted">· {a.reason}</small><br />
              <small>{dateTime(a.appt_at)} {a.doctor && "· Dr. " + a.doctor}</small>
            </span>
            <span className="appointment-actions">
              <span className={"tag " + (a.status === "Done" ? "green" : a.status === "Cancelled" ? "red" : "blue")}>{a.status}</span>{" "}
              {a.status === "Scheduled" && <>
                <button className="btn small" onClick={() => setStatus(a.id, "Done")}>Done</button>
                <button className="btn small" onClick={() => setStatus(a.id, "Cancelled")}>Cancel</button>
              </>}
              <button className="btn small" type="button" onClick={() => openEdit(a)}>Edit</button>
              <button className="btn small danger" type="button" onClick={() => remove(a)}>Delete</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
