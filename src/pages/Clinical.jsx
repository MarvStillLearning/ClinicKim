import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
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
  const [form, setForm] = useState(emptyConsultation);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [recordPage, setRecordPage] = useState(1);
  const [consultationFormOpen, setConsultationFormOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const pageSize = 5;

  async function loadPatients() {
    const { data } = await supabase.from("patients").select("*").order("full_name");
    setPatients(data || []);
  }

  async function loadRecords() {
    setRecordsLoading(true);
    const { data, error } = await supabase
      .from("records")
      .select("*, patients(full_name)")
      .order("created_at", { ascending: false });
    if (error) setMessage(error.message);
    else setRecords(data || []);
    setRecordPage(1);
    setRecordsLoading(false);
  }

  useEffect(() => {
    loadPatients();
    loadRecords();
  }, []);

  useEffect(() => {
    if (!initialPatientId) return;
    const initialPatient = patients.find((item) => String(item.id) === String(initialPatientId));
    if (initialPatient) setPatientId(String(initialPatient.id));
  }, [initialPatientId, patients]);

  async function saveConsultation(event) {
    event.preventDefault();
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
    setPatientId("");
    setConsultationFormOpen(false);
    await loadRecords();
    setSaving(false);
  }

  function printPrescription(record) {
    const patient = patients.find((item) => String(item.id) === String(record.patient_id));
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

  const recordTotalPages = Math.max(1, Math.ceil(records.length / pageSize));
  const currentRecordPage = Math.min(recordPage, recordTotalPages);
  const pagedRecords = records.slice((currentRecordPage - 1) * pageSize, currentRecordPage * pageSize);
  const patient = patients.find((item) => String(item.id) === String(patientId));
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Consultations</h1>
          <p className="muted">View all patient consultation records or add a new consultation.</p>
        </div>
        <button
          className="btn primary"
          type="button"
          onClick={() => {
            setPatientId("");
            setForm(emptyConsultation);
            setMessage("");
            setConsultationFormOpen(true);
          }}
        >
          New consultation
        </button>
      </div>

      <div className="consultation-workspace">
        <div className="card consultation-history">
          <h3>All consultations</h3>
          {recordsLoading ? <p className="muted">Loading consultations...</p> : records.length === 0 ? (
            <p className="muted">No consultations recorded yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Patient</th><th>Complaint</th><th>Diagnosis</th><th className="right">Action</th></tr></thead>
                <tbody>{pagedRecords.map((record) => (
                  <tr key={record.id}>
                    <td>{dateTime(record.created_at)}</td>
                    <td>{record.patients?.full_name || "Unknown patient"}</td>
                    <td>{record.complaint || "-"}</td>
                    <td>{record.diagnosis || "-"}</td>
                    <td className="right"><button className="btn small" type="button" onClick={() => setViewingRecord(record)}>View more</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {!recordsLoading && <Pagination page={recordPage} setPage={setRecordPage} totalItems={records.length} pageSize={pageSize} />}
        </div>
      </div>

      <Modal
        title="Consultation details"
        open={Boolean(viewingRecord)}
        onClose={() => setViewingRecord(null)}
        className="form-modal consultation-details-modal"
      >
        {viewingRecord && (
          <div className="consultation-details">
            <p><small>Patient</small><strong>{viewingRecord.patients?.full_name || "Unknown patient"}</strong></p>
            <p><small>Date</small><strong>{dateTime(viewingRecord.created_at)}</strong></p>
            <p><small>Chief complaint</small><span>{viewingRecord.complaint || "-"}</span></p>
            <p><small>Vitals</small><span>BP: {viewingRecord.bp || "-"} · Temp: {viewingRecord.temperature || "-"} °C · Weight: {viewingRecord.weight || "-"} kg</span></p>
            <p><small>Diagnosis</small><span>{viewingRecord.diagnosis || "-"}</span></p>
            <p><small>Treatment / prescription</small><span>{viewingRecord.treatment || "-"}</span></p>
            <p><small>Doctor's notes</small><span>{viewingRecord.notes || "-"}</span></p>
            <div className="modal-actions">
              <button className="btn" type="button" onClick={() => setViewingRecord(null)}>Close</button>
              <button className="btn primary" type="button" onClick={() => printPrescription(viewingRecord)}><Printer size={15} /> Print Rx</button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        title="New consultation"
        open={consultationFormOpen}
        onClose={() => setConsultationFormOpen(false)}
        className="form-modal"
      >
        <form className="form-grid consultation-form" onSubmit={saveConsultation}>
          <label>Patient
            <select value={patientId} onChange={(event) => setPatientId(event.target.value)} required>
              <option value="">Select a patient...</option>
              {patients.map((item) => (
                <option key={item.id} value={item.id}>{item.full_name} | {item.phone || "No phone"}</option>
              ))}
            </select>
          </label>
          {patient && (
            <p className={`muted${patient.allergies ? " consultation-allergies" : ""}`}>
              Patient allergies: <b>{patient.allergies || "None recorded"}</b>
            </p>
          )}
          {message && <p className="error modal-message">{message}</p>}
          <label>Chief complaint<input value={form.complaint} onChange={set("complaint")} required /></label>
          <label>Blood pressure<input value={form.bp} onChange={set("bp")} placeholder="120/80" /></label>
          <label>Temperature (C)<input value={form.temperature} onChange={set("temperature")} /></label>
          <label>Weight (kg)<input type="number" step="0.1" value={form.weight} onChange={set("weight")} /></label>
          <label>Diagnosis<input value={form.diagnosis} onChange={set("diagnosis")} required /></label>
          <label>Treatment / prescription<textarea value={form.treatment} onChange={set("treatment")} /></label>
          <label>Doctor's notes<textarea value={form.notes} onChange={set("notes")} /></label>
          <div className="modal-actions">
            <button className="btn" type="button" onClick={() => setConsultationFormOpen(false)}>Cancel</button>
            <button className="btn primary" type="submit" disabled={saving || !patientId}>
              {saving ? "Saving..." : "Save consultation"}
            </button>
          </div>
        </form>
      </Modal>

      <ActionLoadingDialog
        open={saving}
        title="Saving consultation"
        description="Recording diagnosis, treatment, and prescription..."
      />
    </div>
  );
}
