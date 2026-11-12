import { useEffect, useState } from "react";
import { Search, Printer } from "lucide-react";
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

export default function Clinical() {
  const [patients, setPatients] = useState([]);
  const [records, setRecords] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyConsultation);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [patientPage, setPatientPage] = useState(1);
  const [recordPage, setRecordPage] = useState(1);
  const [pendingPatient, setPendingPatient] = useState(null);
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

  function selectPatient(id) {
    setPatientId(id);
    setForm(emptyConsultation);
    setMessage("");
    if (id) loadRecords(Number(id));
    else setRecords([]);
  }

  function confirmPatient() {
    if (!pendingPatient) return;
    selectPatient(String(pendingPatient.id));
    setPendingPatient(null);
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

      <div className="consultation-layout">
        <div className="card consultation-patient-list">
          <h3>Select patient</h3>
          <div className="search">
            <Search size={16} />
            <input placeholder="Search patient..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="consultation-patient-options">
            {pagedPatients.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`consultation-patient-option ${String(item.id) === String(patientId) ? "active" : ""}`}
                onClick={() => setPendingPatient(item)}
              >
                <b>{item.full_name}</b>
                <small>{item.phone || "No phone"}</small>
              </button>
            ))}
            {pagedPatients.length === 0 && <p className="muted">No patients found.</p>}
          </div>
          <Pagination page={patientPage} setPage={setPatientPage} totalItems={shownPatients.length} pageSize={pageSize} />
        </div>

        <div className="consultation-workspace">
          {patient && (
            <div className="card consultation-summary">
              <div>
                <small>Selected patient</small>
                <h3>{patient.full_name}</h3>
              </div>
              <span>{patient.sex || "-"} · {patient.birthdate ? `${ageFrom(patient.birthdate)} years` : "Age not set"}</span>
            </div>
          )}

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
      </div>

      <ActionLoadingDialog
        open={saving}
        title="Saving consultation"
        description="Recording diagnosis, treatment, and prescription..."
      />
      <Modal title="Confirm patient before consultation" open={Boolean(pendingPatient)} onClose={() => setPendingPatient(null)} className="staff-modal">
        {pendingPatient && (
          <div className="patient-confirmation">
            <h3>{pendingPatient.full_name}</h3>
            <p><b>Phone:</b> {pendingPatient.phone || "Not recorded"}</p>
            <p><b>Sex / Age:</b> {pendingPatient.sex || "-"}{pendingPatient.birthdate ? ` · ${ageFrom(pendingPatient.birthdate)} years` : ""}</p>
            <p><b>Address:</b> {pendingPatient.address || "Not recorded"}</p>
            {pendingPatient.allergies && <p className="alert"><b>Allergies:</b> {pendingPatient.allergies}</p>}
            {(pendingPatient.emergency_contact_name || pendingPatient.emergency_contact) && (
              <p>
                <b>Emergency contact:</b> {pendingPatient.emergency_contact_name || "Name not recorded"}
                {pendingPatient.emergency_contact && ` · ${pendingPatient.emergency_contact}`}
              </p>
            )}
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setPendingPatient(null)}>Cancel</button>
              <button type="button" className="btn primary" onClick={confirmPatient}>Confirm and consult</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
