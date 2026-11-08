// Patients: search, add/edit, and medical records (consultations).
import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { dateTime, ageFrom } from "../lib/format";
import { Plus, Search } from "lucide-react";
import Modal from "../components/Modal";

const emptyPatient = { full_name: "", birthdate: "", sex: "Male", phone: "", address: "", allergies: "", emergency_contact: "" };
const emptyConsult = { complaint: "", bp: "", temperature: "", weight: "", diagnosis: "", treatment: "", notes: "" };

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(null);       // patient form (null = hidden)
  const [consult, setConsult] = useState(emptyConsult);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadPatients() {
    const { data } = await supabase.from("patients").select("*").order("full_name");
    setPatients(data || []);
  }
  async function loadRecords(id) {
    const { data } = await supabase.from("records").select("*").eq("patient_id", id).order("created_at", { ascending: false });
    setRecords(data || []);
  }
  useEffect(() => { loadPatients(); }, []);

  async function savePatient(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const data = { ...form, birthdate: form.birthdate || null };
    delete data.id; delete data.created_at;
    const result = form.id
      ? await supabase.from("patients").update(data).eq("id", form.id).select().single()
      : await supabase.from("patients").insert(data).select().single();
    if (result.error) {
      setMessage(result.error.message);
      setSaving(false);
      return;
    }
    setForm(null);
    setSelected(result.data);
    await loadPatients();
    setSaving(false);
  }

  async function deletePatient(patient) {
    if (!window.confirm(`Delete ${patient.full_name}? Medical records and appointments linked to this patient will also be removed.`)) return;
    setSaving(true);
    setMessage("");
    const { error } = await supabase.from("patients").delete().eq("id", patient.id);
    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }
    if (selected?.id === patient.id) setSelected(null);
    setForm(null);
    await loadPatients();
    setSaving(false);
  }

  async function saveConsult(e) {
    e.preventDefault();
    const { error } = await supabase.from("records").insert({
      ...consult, weight: consult.weight ? Number(consult.weight) : null, patient_id: selected.id,
    });
    if (error) return alert(error.message);
    setConsult(emptyConsult);
    loadRecords(selected.id);
  }

  function openPatient(p) { setSelected(p); setForm(null); loadRecords(p.id); }
  const shown = patients.filter((p) => p.full_name.toLowerCase().includes(search.toLowerCase()));
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const setC = (field) => (e) => setConsult({ ...consult, [field]: e.target.value });

  return (
    <div>
      <h1>Patients</h1>
      <div className="two-col wide-left">
        {/* LEFT: patient list */}
        <div className="card">
          <div className="toolbar">
            <div className="search"><Search size={16} /><input placeholder="Search patient..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <button className="btn primary" onClick={() => { setForm(emptyPatient); setSelected(null); }}><Plus size={16} /> New</button>
          </div>
          {shown.map((p) => (
            <div key={p.id} className={"list-row clickable" + (selected?.id === p.id ? " selected" : "")} onClick={() => openPatient(p)}>
              <span><b>{p.full_name}</b><br /><small>{p.sex} {p.birthdate ? "· " + ageFrom(p.birthdate) + " yrs" : ""}</small></span>
              <span className="staff-actions">
                <small className="muted">{p.phone}</small>
                <button className="btn small" type="button" disabled={saving} onClick={(e) => {
                  e.stopPropagation();
                  setSelected(p);
                  setForm({ ...p });
                }}>Edit</button>
                <button className="btn small danger" type="button" disabled={saving} onClick={(e) => {
                  e.stopPropagation();
                  deletePatient(p);
                }}>Delete</button>
              </span>
            </div>
          ))}
          {shown.length === 0 && <p className="muted">No patients found.</p>}
        </div>

        {/* RIGHT: form or patient details */}
        <div>
          {!form && !selected && <div className="card"><p className="muted">Select a patient or click "New".</p></div>}

          {!form && selected && (
            <>
              <div className="card">
                <div className="toolbar"><h3>{selected.full_name}</h3><button className="btn" onClick={() => setForm(selected)}>Edit</button></div>
                <p>{selected.sex} · {selected.birthdate ? ageFrom(selected.birthdate) + " yrs" : "Age not set"} · {selected.phone || "No phone"}</p>
                <p><small>{selected.address}</small></p>
                {selected.allergies && <p className="alert">Allergies: {selected.allergies}</p>}
                {selected.emergency_contact && <p><small>Emergency: {selected.emergency_contact}</small></p>}
              </div>

              <form className="card form-grid" onSubmit={saveConsult}>
                <h3>New consultation</h3>
                <label>Complaint<input value={consult.complaint} onChange={setC("complaint")} required /></label>
                <label>Blood pressure<input value={consult.bp} onChange={setC("bp")} placeholder="120/80" /></label>
                <label>Temperature (°C)<input value={consult.temperature} onChange={setC("temperature")} /></label>
                <label>Weight (kg)<input type="number" step="0.1" value={consult.weight} onChange={setC("weight")} /></label>
                <label>Diagnosis<input value={consult.diagnosis} onChange={setC("diagnosis")} required /></label>
                <label>Treatment / Prescription<textarea value={consult.treatment} onChange={setC("treatment")} /></label>
                <label>Notes<textarea value={consult.notes} onChange={setC("notes")} /></label>
                <div><button className="btn primary">Save consultation</button></div>
              </form>

              <div className="card">
                <h3>Medical history</h3>
                {records.length === 0 && <p className="muted">No records yet.</p>}
                {records.map((r) => (
                  <div key={r.id} className="record">
                    <small className="muted">{dateTime(r.created_at)}</small>
                    <div><b>{r.diagnosis}</b> - {r.complaint}</div>
                    <small>BP {r.bp || "-"} · Temp {r.temperature || "-"} · Weight {r.weight || "-"} kg</small>
                    {r.treatment && <div><small><b>Rx:</b> {r.treatment}</small></div>}
                    {r.notes && <div><small>{r.notes}</small></div>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {form && (
        <Modal title={form.id ? "Edit patient" : "New patient"} open={Boolean(form)} onClose={() => setForm(null)} className="form-modal">
          <form className="form-grid" onSubmit={savePatient}>
            {message && <p className="error modal-message">{message}</p>}
            <label>Full name<input value={form.full_name} onChange={set("full_name")} required /></label>
            <label>Birthdate<input type="date" value={form.birthdate || ""} onChange={set("birthdate")} /></label>
            <label>Sex<select value={form.sex || "Male"} onChange={set("sex")}><option>Male</option><option>Female</option></select></label>
            <label>Phone<input value={form.phone || ""} onChange={set("phone")} /></label>
            <label>Address<input value={form.address || ""} onChange={set("address")} /></label>
            <label>Emergency contact<input value={form.emergency_contact || ""} onChange={set("emergency_contact")} /></label>
            <label>Allergies<input value={form.allergies || ""} onChange={set("allergies")} placeholder="e.g. Penicillin" /></label>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn primary" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
