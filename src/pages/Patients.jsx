import { useEffect, useState } from "react";
import { Plus, Eye } from "lucide-react";
import { supabase } from "../supabaseClient";
import { ageFrom, appointmentDateTime } from "../lib/format";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import ActionLoadingDialog from "../components/ActionLoadingDialog";
import DebouncedSearchInput from "../components/DebouncedSearchInput";

const emptyPatient = {
  full_name: "",
  birthdate: "",
  sex: "Male",
  phone: "",
  address: "",
  emergency_contact_name: "",
  emergency_contact: "",
};

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionType, setActionType] = useState("save");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  async function loadPatients() {
    const { data } = await supabase.from("patients").select("*").order("full_name");
    setPatients(data || []);
  }

  useEffect(() => { loadPatients(); }, []);

  async function loadTimeline(patient) {
    setSelected(patient);
    setTimeline([]);
    setTimelineLoading(true);
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
    setTimelineLoading(false);
  }

  async function viewPatient(patient) {
    setSelected(patient);
    setTimeline([]);
    setProfileOpen(true);
    await loadTimeline(patient);
  }

  async function savePatient(e) {
    e.preventDefault();
    setSaving(true);
    setActionType("save");
    setMessage("");

    const data = { ...form, birthdate: form.birthdate || null };
    delete data.id;
    delete data.created_at;
    delete data.allergies;

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

      <div>
        <div className="card">
          <div className="toolbar">
            <DebouncedSearchInput className="search" placeholder="Search patient..." onSearch={setSearch} />
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
                    <tr key={patient.id}>
                      <td><b>{(currentPage - 1) * pageSize + index + 1}</b></td>
                      <td><b>{patient.full_name}</b></td>
                      <td>{patient.sex || "-"}{patient.birthdate ? ` · ${ageFrom(patient.birthdate)} yrs` : ""}</td>
                      <td>{patient.phone || "-"}</td>
                      <td className="right">
                        <div className="patient-row-actions">
                          <button className="btn small" type="button" disabled={saving} onClick={() => viewPatient(patient)}>
                            <Eye size={14} /> View information
                          </button>
                          <button className="btn small" type="button" disabled={saving} onClick={() => setForm({ ...patient })}>Edit</button>
                          <button className="btn small danger" type="button" disabled={saving} onClick={() => deletePatient(patient)}>Delete</button>
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

      </div>

      <Modal title="Patient information" open={profileOpen && Boolean(selected)} onClose={() => setProfileOpen(false)} className="patient-profile-modal">
        {selected && (
          <>
            <div className="patient-profile-details">
              <div className="patient-profile-heading">
                <h3>{selected.full_name}</h3>
                <span className="patient-profile-badge">Patient profile</span>
              </div>
              <div><small>Sex</small><span>{selected.sex || "Not recorded"}</span></div>
              <div><small>Birthdate / age</small><span>{selected.birthdate ? `${selected.birthdate} · ${ageFrom(selected.birthdate)} years` : "Not recorded"}</span></div>
              <div><small>Phone</small><span>{selected.phone || "Not recorded"}</span></div>
              <div><small>Address</small><span>{selected.address || "Not recorded"}</span></div>
              <div><small>Emergency contact name</small><span>{selected.emergency_contact_name || "Not recorded"}</span></div>
              <div><small>Emergency contact phone</small><span>{selected.emergency_contact || "Not recorded"}</span></div>
            </div>
            <h3 className="patient-profile-timeline-title">Patient timeline</h3>
            {timelineLoading ? <p className="muted">Loading patient timeline...</p> : timeline.length === 0 ? <p className="muted">No appointments, consultations, or payments yet.</p> : (
              <div className="patient-profile-timeline">
                <table>
                  <thead><tr><th>Type</th><th>Details</th><th>Date and time</th></tr></thead>
                  <tbody>{timeline.map((item) => (
                    <tr key={item.id}>
                      <td><span className={`tag ${item.type === "Appointment" ? "blue" : item.type === "Consultation" ? "green" : ""}`}>{item.type}</span></td>
                      <td>{item.detail}</td>
                      <td>{item.type === "Appointment" ? appointmentDateTime(item.date) : new Date(item.date).toLocaleString("en-PH")}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Modal>

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
