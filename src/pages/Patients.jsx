import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { supabase } from "../supabaseClient";
import { ageFrom } from "../lib/format";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import ActionLoadingDialog from "../components/ActionLoadingDialog";

const emptyPatient = {
  full_name: "",
  birthdate: "",
  sex: "Male",
  phone: "",
  address: "",
  allergies: "",
  emergency_contact_name: "",
  emergency_contact: "",
};

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionType, setActionType] = useState("save");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  async function loadPatients() {
    const { data } = await supabase.from("patients").select("*").order("full_name");
    setPatients(data || []);
  }

  useEffect(() => { loadPatients(); }, []);

  async function loadTimeline(patient) {
    setSelected(patient);
    setTimeline([]);
    const [appointmentsResult, recordsResult, salesResult] = await Promise.all([
      supabase.from("appointments").select("id, appt_at, reason, doctor, status").eq("patient_id", patient.id).order("appt_at", { ascending: false }),
      supabase.from("records").select("id, created_at, complaint, diagnosis, treatment").eq("patient_id", patient.id).order("created_at", { ascending: false }),
      supabase.from("sales").select("id, created_at, total, payment_method").eq("patient_id", patient.id).order("created_at", { ascending: false }),
    ]);
    const items = [
      ...(appointmentsResult.data || []).map((item) => ({ id: `appointment-${item.id}`, date: item.appt_at, type: "Appointment", detail: `${item.reason || "Consultation"} · ${item.doctor ? `Dr. ${item.doctor}` : "Doctor not set"} · ${item.status}` })),
      ...(recordsResult.data || []).map((item) => ({ id: `record-${item.id}`, date: item.created_at, type: "Consultation", detail: item.diagnosis ? `Diagnosis: ${item.diagnosis}` : item.complaint || "Clinical record" })),
      ...(salesResult.data || []).map((item) => ({ id: `sale-${item.id}`, date: item.created_at, type: "Payment", detail: `${item.payment_method || "Payment"} · ₱${Number(item.total).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));
    setTimeline(items);
  }

  async function savePatient(e) {
    e.preventDefault();
    setSaving(true);
    setActionType("save");
    setMessage("");

    const data = { ...form, birthdate: form.birthdate || null };
    delete data.id;
    delete data.created_at;

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
    if (!window.confirm(`Delete ${patient.full_name}? Linked medical records and appointments will also be removed.`)) return;
    setSaving(true);
    setActionType("delete");
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

  const shown = patients.filter((patient) =>
    patient.full_name.toLowerCase().includes(search.trim().toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(shown.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedPatients = shown.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => { setPage(1); }, [search]);
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Patient Management</h1>
          <p className="muted">Patient profiles and demographic information</p>
        </div>
      </div>

      <div className="two-col wide-left">
        <div className="card">
          <div className="toolbar">
            <div className="search">
              <Search size={16} />
              <input placeholder="Search patient..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button className="btn primary" type="button" onClick={() => { setForm(emptyPatient); setSelected(null); }}>
              <Plus size={16} /> New patient
            </button>
          </div>

          {shown.length === 0 ? <p className="muted">No patients found.</p> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Name</th><th>Sex / Age</th><th>Phone</th><th className="right">Actions</th></tr></thead>
                <tbody>
                  {pagedPatients.map((patient, index) => (
                    <tr
                      key={patient.id}
                      className={selected?.id === patient.id ? "clickable selected" : "clickable"}
                      onClick={() => loadTimeline(patient)}
                    >
                      <td><b>{(currentPage - 1) * pageSize + index + 1}</b></td>
                      <td><b>{patient.full_name}</b></td>
                      <td>{patient.sex || "-"}{patient.birthdate ? ` · ${ageFrom(patient.birthdate)} yrs` : ""}</td>
                      <td>{patient.phone || "-"}</td>
                      <td className="right">
                        <button className="btn small" type="button" disabled={saving} onClick={(e) => {
                          e.stopPropagation();
                          loadTimeline(patient);
                          setForm({ ...patient });
                        }}>Edit</button>{" "}
                        <button className="btn small danger" type="button" disabled={saving} onClick={(e) => {
                          e.stopPropagation();
                          deletePatient(patient);
                        }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} setPage={setPage} totalItems={shown.length} pageSize={pageSize} />
        </div>

        <div>
          {!selected ? (
            <div className="card">
              <p className="muted">Select a patient to view their profile.</p>
            </div>
          ) : (
            <div className="card">
              <div className="toolbar">
                <h3>{selected.full_name}</h3>
                <button className="btn" type="button" onClick={() => setForm({ ...selected })}>Edit</button>
              </div>
              <p>{selected.sex || "-"} · {selected.birthdate ? `${ageFrom(selected.birthdate)} years` : "Age not set"} · {selected.phone || "No phone"}</p>
              {selected.address && <p><small>{selected.address}</small></p>}
              {selected.allergies && <p className="alert">Allergies: {selected.allergies}</p>}
              {(selected.emergency_contact_name || selected.emergency_contact) && (
                <p><small>
                  Emergency contact: {selected.emergency_contact_name || "Name not recorded"}
                  {selected.emergency_contact && ` · ${selected.emergency_contact}`}
                </small></p>
              )}
              <h3 style={{ marginTop: 18 }}>Patient timeline</h3>
              {timeline.length === 0 && <p className="muted">No appointments, consultations, or payments yet.</p>}
              {timeline.map((item) => (
                <div className="list-row" key={item.id}>
                  <span><b>{item.type}</b><br /><small>{item.detail}</small></span>
                  <span className="muted">{new Date(item.date).toLocaleString("en-PH")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal title={form?.id ? "Edit patient" : "New patient"} open={Boolean(form)} onClose={() => setForm(null)} className="form-modal">
        {form && (
          <form className="form-grid" onSubmit={savePatient}>
            {message && <p className="error modal-message">{message}</p>}
            <label>Full name<input value={form.full_name} onChange={set("full_name")} required /></label>
            <label>Birthdate<input type="date" value={form.birthdate || ""} onChange={set("birthdate")} /></label>
            <label>Sex<select value={form.sex || "Male"} onChange={set("sex")}><option>Male</option><option>Female</option></select></label>
            <label>Phone<input value={form.phone || ""} onChange={set("phone")} /></label>
            <label>Address<input value={form.address || ""} onChange={set("address")} /></label>
            <label>Emergency contact name<input value={form.emergency_contact_name || ""} onChange={set("emergency_contact_name")} /></label>
            <label>Emergency contact phone<input value={form.emergency_contact || ""} onChange={set("emergency_contact")} /></label>
            <label>Allergies<input value={form.allergies || ""} onChange={set("allergies")} placeholder="e.g. Penicillin" /></label>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </form>
        )}
      </Modal>

      <ActionLoadingDialog
        open={saving}
        title={actionType === "delete" ? "Deleting patient" : form?.id ? "Saving patient changes" : "Saving patient"}
        description={actionType === "delete" ? "Removing the patient and linked records..." : "Saving patient profile information..."}
        danger={actionType === "delete"}
      />
    </div>
  );
}
