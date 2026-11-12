import { useEffect, useState } from "react";
import { Search, Printer, UserRound } from "lucide-react";
import { supabase } from "../supabaseClient";
import { ageFrom, dateTime, CLINIC_NAME } from "../lib/format";
import Pagination from "../components/Pagination";
import ActionLoadingDialog from "../components/ActionLoadingDialog";
import Modal from "../components/Modal";

const emptyConsultation = {
  complaint: "",
  bp: "",
  temperature: "",
  weight: "",
  diagnosis: "",
  treatment: "",
  notes: "",
};

export default function Clinical({ initialPatientId = "" }) {
  const [patients, setPatients] = useState([]);
  const [records, setRecords] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyConsultation);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [patientPage, setPatientPage] = useState(1);
  const [recordPage, setRecordPage] = useState(1);
  const [patientPickerOpen, setPatientPickerOpen] = useState(false);
  const pageSize = 10;

  async function loadPatients() {
    const { data } = await supabase.from("patients").select("*").order("full_name");
    setPatients(data || []);
  }

  async function loadRecords(id) {
    const { data } = await supabase
      .from("records")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false });
    setRecords(data || []);
    setRecordPage(1);
  }

  useEffect(() => { loadPatients(); }, []);

  useEffect(() => {
    if (!initialPatientId) return;
    const initialPatient = patients.find((item) => String(item.id) === String(initialPatientId));
    if (initialPatient && String(patientId) !== String(initialPatient.id)) {
      selectPatient(String(initialPatient.id));
    }
  }, [initialPatientId, patients]);

  function selectPatient(id) {
    setPatientId(id);
    setForm(emptyConsultation);
    setMessage("");
    if (id) loadRecords(Number(id));
    else setRecords([]);
  }

  function choosePatient(item) {
    selectPatient(String(item.id));
    setPatientPickerOpen(false);
  }

  async function saveConsultation(e) {
    e.preventDefault();
    if (!patientId) {
      setMessage("Select a patient before saving the consultation.");
      return;
    }

    setSaving(true);
    setMessage("");
    const { error } = await supabase.from("records").insert({
      ...form,
      weight: form.weight ? Number(form.weight) : null,
      patient_id: Number(patientId),
    });

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setForm(emptyConsultation);
    await loadRecords(Number(patientId));
    setSaving(false);
  }

  function printPrescription(record) {
    const patient = patients.find((item) => String(item.id) === String(patientId));
    if (!patient) return;
    const escape = (value) => String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const printed = window.open("", "_blank", "width=800,height=600");
    if (!printed) {
      setMessage("Allow pop-ups to print the prescription.");
      return;
    }

    printed.document.write(`<!doctype html>
      <html><head><title>Prescription</title><style>
        body{font-family:Arial,sans-serif;margin:40px;color:#111}
        .clinic{text-align:center;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:20px}
        .meta{display:flex;justify-content:space-between;margin-bottom:20px}
        .rx{font-size:28px;font-weight:bold;margin:20px 0 10px}
        .prescription{white-space:pre-wrap;border:1px solid #ccc;padding:16px;min-height:180px}
        @media print{button{display:none}}
      </style></head><body>
        <div class="clinic"><h2>${escape(CLINIC_NAME)}</h2><small>Medical Prescription</small></div>
        <div class="meta"><span><b>Patient:</b> ${escape(patient.full_name)}</span><span><b>Date:</b> ${escape(dateTime(record.created_at))}</span></div>
        ${patient.birthdate ? `<p><b>Age:</b> ${escape(ageFrom(patient.birthdate))} years</p>` : ""}
        <p><b>Diagnosis:</b> ${escape(record.diagnosis || "-")}</p>
        <div class="rx">Rx</div><div class="prescription">${escape(record.treatment || "No prescription recorded.")}</div>
        <p style="margin-top:50px">__________________________<br><small>Doctor's signature</small></p>
        <button onclick="window.print()">Print prescription</button>
      </body></html>`);
    printed.document.close();
  }

  const shownPatients = patients.filter((patient) =>
    patient.full_name.toLowerCase().includes(search.trim().toLowerCase())
  );
  const patientTotalPages = Math.max(1, Math.ceil(shownPatients.length / pageSize));
  const currentPatientPage = Math.min(patientPage, patientTotalPages);
  const pagedPatients = shownPatients.slice((currentPatientPage - 1) * pageSize, currentPatientPage * pageSize);
  useEffect(() => { setPatientPage(1); }, [search]);

  const recordTotalPages = Math.max(1, Math.ceil(records.length / pageSize));
  const currentRecordPage = Math.min(recordPage, recordTotalPages);
  const pagedRecords = records.slice((currentRecordPage - 1) * pageSize, currentRecordPage * pageSize);

  const patient = patients.find((item) => String(item.id) === String(patientId));
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Consultations</h1>
          <p className="muted">Clinical notes, diagnosis, treatment, and prescriptions</p>
        </div>
      </div>

      <div className="consultation-workspace">
        <div className="card consultation-patient-select">
          {patient && (
            <div className="consultation-summary">
              <div>
                <small>Selected patient</small>
                <h3>{patient.full_name}</h3>
              </div>
              <div className="consultation-selected-details">
                <span><b>Sex / age:</b> {patient.sex || "Not recorded"} · {patient.birthdate ? `${ageFrom(patient.birthdate)} years` : "Age not set"}</span>
                <span><b>Phone:</b> {patient.phone || "Not recorded"}</span>
                <span><b>Address:</b> {patient.address || "Not recorded"}</span>
                <span className={patient.allergies ? "consultation-allergies" : ""}><b>Allergies:</b> {patient.allergies || "None recorded"}</span>
                <span><b>Emergency contact:</b> {[patient.emergency_contact_name, patient.emergency_contact].filter(Boolean).join(" · ") || "Not recorded"}</span>
              </div>
            </div>
          )}
          {!patient && <p className="muted">Select a patient before starting a consultation.</p>}
          <button className="btn primary" type="button" onClick={() => {
            setPatientPickerOpen(true);
          }}>
            <UserRound size={16} /> {patient ? "Change patient" : "Select patient"}
          </button>
        </div>

        <form className="card form-grid consultation-form" onSubmit={saveConsultation}>
          <h3>New consultation</h3>
          {message && <p className="error modal-message">{message}</p>}
          <label>Chief complaint<input value={form.complaint} onChange={set("complaint")} required /></label>
          <label>Blood pressure<input value={form.bp} onChange={set("bp")} placeholder="120/80" /></label>
          <label>Temperature (°C)<input value={form.temperature} onChange={set("temperature")} /></label>
          <label>Weight (kg)<input type="number" step="0.1" value={form.weight} onChange={set("weight")} /></label>
          <label>Diagnosis<input value={form.diagnosis} onChange={set("diagnosis")} required /></label>
          <label>Treatment / prescription<textarea value={form.treatment} onChange={set("treatment")} /></label>
          <label>Doctor's notes<textarea value={form.notes} onChange={set("notes")} /></label>
          <div className="modal-actions">
            <button className="btn primary" type="submit" disabled={saving || !patientId}>
              {saving ? "Saving..." : "Save consultation"}
            </button>
          </div>
        </form>

        <div className="card consultation-history">
          <h3>Consultation history</h3>
          {!patientId && <p className="muted">Select a patient to view consultation history.</p>}
          {patientId && records.length === 0 && <p className="muted">No consultations yet.</p>}
          {pagedRecords.map((record) => (
            <div className="consultation-record" key={record.id}>
              <div className="consultation-record-header">
                <span><b>{dateTime(record.created_at)}</b></span>
                <button className="btn small" type="button" onClick={() => printPrescription(record)}>
                  <Printer size={14} /> Print Rx
                </button>
              </div>
              <div className="consultation-record-grid">
                <div><small>Complaint</small><p>{record.complaint || "-"}</p></div>
                <div><small>Vitals</small><p>BP: {record.bp || "-"} · Temp: {record.temperature || "-"} · Weight: {record.weight || "-"} kg</p></div>
                <div><small>Diagnosis</small><p>{record.diagnosis || "-"}</p></div>
                <div><small>Prescription</small><p>{record.treatment || "-"}</p></div>
              </div>
            </div>
          ))}
          {patientId && <Pagination page={recordPage} setPage={setRecordPage} totalItems={records.length} pageSize={pageSize} />}
        </div>
      </div>

      <ActionLoadingDialog
        open={saving}
        title="Saving consultation"
        description="Recording diagnosis, treatment, and prescription..."
      />
      <Modal
        title="Select patient"
        open={patientPickerOpen}
        onClose={() => setPatientPickerOpen(false)}
        className="consultation-patient-modal"
      >
        <div className="search">
          <Search size={16} />
          <input placeholder="Search patient..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        </div>
        <div className="consultation-patient-options">
          {pagedPatients.map((item) => (
            <article className="consultation-patient-option" key={item.id}>
              <div className="consultation-patient-option-header">
                <b>{item.full_name}</b>
                <button type="button" className="btn small primary" onClick={() => choosePatient(item)}>Select patient</button>
              </div>
              <div className="consultation-patient-details">
                <div><small>Sex / age</small><span>{item.sex || "Not recorded"} · {item.birthdate ? `${ageFrom(item.birthdate)} years` : "Age not set"}</span></div>
                <div><small>Birth date</small><span>{item.birthdate || "Not recorded"}</span></div>
                <div><small>Phone</small><span>{item.phone || "Not recorded"}</span></div>
                <div><small>Address</small><span>{item.address || "Not recorded"}</span></div>
                <div className={item.allergies ? "consultation-allergies" : ""}><small>Allergies</small><span>{item.allergies || "None recorded"}</span></div>
                <div><small>Emergency contact name</small><span>{item.emergency_contact_name || "Not recorded"}</span></div>
                <div><small>Emergency contact phone</small><span>{item.emergency_contact || "Not recorded"}</span></div>
              </div>
            </article>
          ))}
          {pagedPatients.length === 0 && <p className="muted">No patients found.</p>}
        </div>
        <Pagination page={patientPage} setPage={setPatientPage} totalItems={shownPatients.length} pageSize={pageSize} />
      </Modal>
    </div>
  );
}
