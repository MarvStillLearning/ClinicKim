import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import ActionLoadingDialog from "../components/ActionLoadingDialog";
import PasswordInput from "../components/PasswordInput";

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "nurse" });
  const [saving, setSaving] = useState(false);
  const [actionType, setActionType] = useState("save");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  async function getFunctionErrorMessage(error, fallback) {
    if (error.context instanceof Response) {
      const body = await error.context.clone().json().catch(() => null);
      if (typeof body?.error === "string") return body.error;
    }

    return error.message || fallback;
  }

  async function load() {
    const { data, error } = await supabase.from("profiles").select("*").order("full_name");
    if (error) setMessage(error.message);
    setStaff(data || []);
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ full_name: "", email: "", password: "", role: "nurse" });
    setMessage("");
    setShowForm(true);
  }

  function openEdit(member) {
    setEditing(member);
    setForm({
      full_name: member.full_name || "",
      email: member.email || "",
      password: "",
      role: member.role === "doctor" ? "doctor" : "nurse",
    });
    setMessage("");
    setShowForm(true);
  }

  async function saveUser(e) {
    e.preventDefault();
    setSaving(true);
    setActionType("save");
    const actionTitle = editing ? "Saving changes" : "Creating staff account";
    setMessage("");

    const action = editing ? "update" : "create";
    const body = editing
      ? { action, id: editing.id, full_name: form.full_name.trim(), email: form.email.trim(), role: form.role, password: form.password || undefined }
      : { action, full_name: form.full_name.trim(), email: form.email.trim(), role: form.role, password: form.password };

    const { error } = await supabase.functions.invoke("staff-admin", { body });
    if (error) {
      const errorMessage = await getFunctionErrorMessage(error, "Unable to save staff account.");
      if (errorMessage.includes("Failed to send a request")) {
        setMessage('Staff account service is not available. Deploy the "staff-admin" function and verify that the CLINIC_APP_ORIGIN secret matches this site.');
      } else {
        setMessage(errorMessage);
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
    setActionType("delete");
    setMessage("");

    try {
      const { error } = await supabase.functions.invoke("staff-admin", {
        body: { action: "delete", id: member.id },
      });

      if (error) {
        const errorMessage = await getFunctionErrorMessage(error, "Unable to delete staff account.");
        if (/failed to send a request|failed to fetch|networkerror/i.test(errorMessage)) {
          setMessage('Staff account service is not available. Deploy the "staff-admin" function and verify that the CLINIC_APP_ORIGIN secret matches this site.');
        } else {
          setMessage(errorMessage);
        }
      } else {
        await load();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete staff account.");
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(staff.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedStaff = staff.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <h1>Staff & Roles</h1>
      <div className="card">
        <div className="toolbar">
          <span className="muted">Manage staff accounts and access roles.</span>
          <button className="btn primary" type="button" onClick={openAdd}>Add Staff</button>
        </div>
        {message && <p className="error" role="alert">{message}</p>}
        {staff.length === 0 && <p className="muted">No staff found.</p>}
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Role</th><th className="right">Actions</th></tr></thead>
            <tbody>
              {pagedStaff.map((member, index) => (
                <tr key={member.id}>
                  <td><b>{(currentPage - 1) * pageSize + index + 1}</b></td>
                  <td><b>{member.full_name || "Unnamed staff"}</b></td>
                  <td>{member.email || "-"}</td>
                  <td><span className={`tag ${member.role === "admin" ? "red" : member.role === "doctor" ? "blue" : "green"}`}>{member.role === "admin" ? "System admin" : member.role}</span></td>
                  <td className="right">
                    {member.role !== "admin" && <>
                      <button className="btn small" type="button" onClick={() => openEdit(member)}>Edit</button>{" "}
                      <button className="btn small danger" type="button" disabled={saving} onClick={() => deleteUser(member)}>Delete</button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} setPage={setPage} totalItems={staff.length} pageSize={pageSize} />
      </div>

      {showForm && (
        <Modal title={editing ? "Edit Staff" : "Add Staff"} open={showForm} onClose={() => setShowForm(false)} className="staff-modal">
          <form className="staff-modal-form" onSubmit={saveUser}>
            <label>Full Name<input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></label>
            <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
            <label>{editing ? "New Password (leave blank to keep)" : "Password"}<PasswordInput minLength={12} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} /></label>
            <label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="doctor">Doctor</option><option value="nurse">Nurse</option></select></label>
            <div className="modal-actions"><button className="btn" type="button" onClick={() => setShowForm(false)}>Cancel</button><button className="btn primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</button></div>
          </form>
        </Modal>
      )}
      <ActionLoadingDialog
        open={saving}
        title={actionType === "delete" ? "Deleting staff account" : editing ? "Saving staff changes" : "Creating staff account"}
        description={actionType === "delete" ? "Removing account access and profile data..." : "Updating staff information and permissions..."}
        danger={actionType === "delete"}

      />
    </div>
  );
}
