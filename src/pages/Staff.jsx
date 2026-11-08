import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Modal from "../components/Modal";

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "cashier" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const { data, error } = await supabase.from("profiles").select("*").order("full_name");
    if (error) setMessage(error.message);
    setStaff(data || []);
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ full_name: "", email: "", password: "", role: "cashier" });
    setMessage("");
    setShowForm(true);
  }

  function openEdit(member) {
    setEditing(member);
    setForm({
      full_name: member.full_name || "",
      email: member.email || "",
      password: "",
      role: member.role || "cashier",
    });
    setMessage("");
    setShowForm(true);
  }

  async function saveUser(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const action = editing ? "update" : "create";
    const body = editing
      ? { action, id: editing.id, full_name: form.full_name.trim(), email: form.email.trim(), role: form.role, password: form.password || undefined }
      : { action, full_name: form.full_name.trim(), email: form.email.trim(), role: form.role, password: form.password };

    const { error } = await supabase.functions.invoke("staff-admin", { body });
    if (error) {
      if (error.message?.includes("Failed to send a request")) {
        setMessage('Staff account service is not available. Deploy the "staff-admin" Supabase Edge Function, then try again.');
      } else {
        setMessage(error.message || "Unable to save staff account.");
      }
    }
    else {
      setShowForm(false);
      await load();
    }
    setSaving(false);
  }

  async function deleteUser(member) {
    if (!window.confirm(`Delete ${member.full_name || member.email}? This cannot be undone.`)) return;
    setSaving(true);
    setMessage("");
    const { error } = await supabase.functions.invoke("staff-admin", {
      body: { action: "delete", id: member.id },
    });
    if (error) {
      if (error.message?.includes("Failed to send a request")) {
        setMessage('Staff account service is not available. Deploy the "staff-admin" Supabase Edge Function, then try again.');
      } else {
        setMessage(error.message || "Unable to delete staff account.");
      }
    }
    else await load();
    setSaving(false);
  }

  return (
    <div>
      <h1>Staff & Roles</h1>
      <div className="card">
        <div className="toolbar">
          <span className="muted">Manage staff accounts and access roles.</span>
          <button className="btn primary" type="button" onClick={openAdd}>Add Staff</button>
        </div>
        {message && <p className="error">{message}</p>}
        {staff.map((member) => (
          <div key={member.id} className="list-row staff-row">
            <div>
              <strong>{member.full_name || member.email || "Unnamed staff"}</strong>
              <div className="muted staff-email">{member.email || "No email on profile"}</div>
            </div>
            <div className="staff-actions">
              <span className={`tag ${member.role === "admin" ? "red" : member.role === "doctor" ? "blue" : "green"}`}>
                {member.role}
              </span>
              <button className="btn small" type="button" onClick={() => openEdit(member)}>Edit</button>
              <button className="btn small danger" type="button" disabled={saving} onClick={() => deleteUser(member)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <Modal title={editing ? "Edit Staff" : "Add Staff"} open={showForm} onClose={() => setShowForm(false)} className="staff-modal">
          <form className="staff-modal-form" onSubmit={saveUser}>
            <label>Full Name<input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></label>
            <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
            <label>{editing ? "New Password (leave blank to keep)" : "Password"}<input type="password" minLength={12} autoComplete={editing ? "new-password" : "new-password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} /></label>
            <label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="admin">Admin</option><option value="doctor">Doctor</option><option value="cashier">Cashier</option></select></label>
            <div className="modal-actions"><button className="btn" type="button" onClick={() => setShowForm(false)}>Cancel</button><button className="btn primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
