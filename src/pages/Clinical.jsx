import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Clinical({ user }) {
  const [patients, setPatients] = useState([]);
  const [records, setRecords] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [form, setForm] = useState({ subject: "", objective: "", assessment: "", plan: "", diagnosis: "", treatment: "", prescription: "", vitals: "" });

  async function loadPatients() { const { data } = await supabase.from("patients").select("*").order("full_name"); setPatients(data || []); }
  async function loadRecords(id) { const { data } = await supabase.from("records").select("*").eq("patient_id", id).order("created_at", { ascending: false }); setRecords(data || []); }
  useEffect(() => { loadPatients(); }, []);
  function selectPatient(id) { setPatientId(id); loadRecords(id); }

  async function save(e) {
    e.preventEvent?.();
    e.preventDefault();
    if (!patientId) return alert("Select a patient");
    const { error } = await supabase.from("records").insert({ ...form, diagnosis: form.assessment || form.diagnosis, treatment: form.plan || form.treatment, patient_id: Number(patientId), created_by: user.id });
    if (error) return alert(error.message);
    setForm({ subject: "", objective: "", assessment: "", plan: "", diagnosis: "", treatment: "", prescription: "", vitals: "" }); loadRecords(patientId);
  }

  const patient = patients.find((p) => String(p.id) === String(patientId));
  return <div><div className="page-heading"><div><h2>Clinical consultation</h2><p>SOAP notes, vitals, diagnosis, and prescriptions</p></div></div><div className="layout-grid">
    <div className="card"><h3>Select patient</h3><select className="full" value={patientId} onChange={(e) => selectPatient(e.target.value)}><option value="">Choose patient</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>{patient && <div className="patient-summary"><strong>{patient.full_name}</strong><span>{patient.age ? `${patient.age} years` : "Age not recorded"} · {patient.phone || "No phone"}</span></div>}</div>
    <div className="card wide"><h3>New SOAP consultation</h3><form className="consultation-form" onSubmit={save}><input placeholder="Vital signs (BP, pulse, temperature, SpO₂)" value={form.vitals} onChange={(e) => setForm({ ...form, vitals: e.target.value })}/><textarea placeholder="Subjective — symptoms and patient history" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}/><textarea placeholder="Objective — examination findings" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })}/><textarea placeholder="Assessment / diagnosis" value={form.assessment} onChange={(e) => setForm({ ...form, assessment: e.target.value })} required/><textarea placeholder="Plan / treatment" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}/><textarea placeholder="Prescription / medicines and instructions" value={form.prescription} onChange={(e) => setForm({ ...form, prescription: e.target.value })}/><button>Save consultation</button></form></div>
    <div className="card wide full-span"><h3>Medical history</h3>{records.map((r) => <div className="record" key={r.id}><small>{new Date(r.created_at).toLocaleString()}</small><div><b>Vitals:</b> {r.vitals || "—"}</div><div><b>Subjective:</b> {r.subject || "—"}</div><div><b>Objective:</b> {r.objective || "—"}</div><div><b>Assessment:</b> {r.diagnosis || "—"}</div><div><b>Plan:</b> {r.treatment || "—"}</div><div><b>Prescription:</b> {r.prescription || "—"}</div></div>)}</div>
  </div></div>;
}
