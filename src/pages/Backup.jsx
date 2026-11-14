import { useRef, useState } from "react";
import { Archive, Download, ShieldCheck } from "lucide-react";
import { supabase } from "../supabaseClient";
import Modal from "../components/Modal";
import PasswordInput from "../components/PasswordInput";
import { decryptBackup, encryptBackup } from "../lib/backupCrypto";

const TABLES = [
  "profiles",
  "patients",
  "records",
  "appointments",
  "doctor_schedule_dates",
  "products",
  "sales",
  "sale_items",
  "audit_logs",
];
const PAGE_SIZE = 500;
const MAX_IMPORT_SIZE = 25 * 1024 * 1024;

async function readAllRows(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

function fileTimestamp(date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export default function Backup({ role }) {
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [exportKeyOpen, setExportKeyOpen] = useState(false);
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [keyError, setKeyError] = useState("");
  const [decryptKeyOpen, setDecryptKeyOpen] = useState(false);
  const [encryptedFile, setEncryptedFile] = useState(null);
  const [importPassphrase, setImportPassphrase] = useState("");
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState("");
  const [pendingImport, setPendingImport] = useState(null);
  const importInput = useRef(null);

  async function chooseBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage("");
    setError("");
    if (file.size > MAX_IMPORT_SIZE) {
      setError("Backup file is larger than 25 MB. Import a smaller backup file.");
      return;
    }
    try {
      const envelope = JSON.parse(await file.text());
      if (envelope?.format !== "clinic-system-encrypted-backup" || envelope?.version !== 1) {
        throw new Error("This file is not an encrypted clinic backup. Create a new encrypted backup and use that file.");
      }
      setEncryptedFile({ envelope, fileName: file.name });
      setImportPassphrase("");
      setDecryptError("");
      setDecryptKeyOpen(true);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Unable to read this backup file.");
    }
  }

  async function unlockBackup(event) {
    event.preventDefault();
    if (!encryptedFile || !importPassphrase) return;
    setDecrypting(true);
    setDecryptError("");
    try {
      const backup = await decryptBackup(encryptedFile.envelope, importPassphrase);
      const missing = TABLES.filter((table) => !Array.isArray(backup.tables[table]));
      if (missing.length) throw new Error(`Backup is missing table data: ${missing.join(", ")}.`);
      setPendingImport({ backup, fileName: encryptedFile.fileName });
      setEncryptedFile(null);
      setDecryptKeyOpen(false);
      setImportPassphrase("");
    } catch (unlockError) {
      setDecryptError(unlockError instanceof Error ? unlockError.message : "Unable to decrypt this backup.");
    } finally {
      setDecrypting(false);
    }
  }

  async function importBackup() {
    if (!pendingImport) return;
    setImporting(true);
    setError("");
    setMessage("");
    try {
      const { data, error: importError } = await supabase.rpc("import_clinic_backup", {
        p_backup: pendingImport.backup,
      });
      if (importError) {
        setError(importError.message);
        return;
      }
      const rows = Object.values(data?.rows || {}).reduce((sum, count) => sum + Number(count || 0), 0);
      setMessage(`Imported ${rows.toLocaleString()} records from ${pendingImport.fileName}.`);
      setPendingImport(null);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Unable to import this backup.");
    } finally {
      setImporting(false);
    }
  }

  async function downloadBackup(event) {
    event?.preventDefault();
    if (exportPassphrase.length < 12) {
      setKeyError("Use a passphrase with at least 12 characters.");
      return;
    }
    if (exportPassphrase !== confirmPassphrase) {
      setKeyError("The passphrases do not match.");
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    setKeyError("");
    try {
      const exported = await Promise.all(TABLES.map(async (table) => [table, await readAllRows(table)]));
      const createdAt = new Date();
      const backup = {
        format: "clinic-system-backup",
        version: 1,
        created_at: createdAt.toISOString(),
        tables: Object.fromEntries(exported),
      };
      const encrypted = await encryptBackup(backup, exportPassphrase);
      const blob = new Blob([JSON.stringify(encrypted)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `clinic-backup-encrypted-${fileTimestamp(createdAt)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      const rowCount = exported.reduce((total, [, rows]) => total + rows.length, 0);
      setMessage(`Encrypted backup downloaded: ${rowCount.toLocaleString()} records from ${TABLES.length} tables.`);
      setExportKeyOpen(false);
      setExportPassphrase("");
      setConfirmPassphrase("");
    } catch (backupError) {
      setKeyError(backupError instanceof Error ? backupError.message : "Unable to create encrypted backup.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="backup-page">
      <div className="page-header">
        <div>
          <h1>Data backup</h1>
          <p className="muted">Download a copy of clinic records, accounts, schedules, inventory, sales, and audit history.</p>
        </div>
      </div>
      <section className="card backup-card">
        <div className="backup-icon"><Archive size={22} /></div>
        <div className="backup-copy">
          <h2>Clinic database backup</h2>
          <p className="muted">Creates a timestamped AES-256-GCM encrypted backup containing all application tables. Choose a strong passphrase and store it separately; it cannot be recovered if lost.</p>
          <div className="backup-coverage"><ShieldCheck size={16} /> {TABLES.length} tables included</div>
          {role === "admin" && <p className="backup-import-note">Only AES-256-GCM encrypted clinic backups are accepted (up to 25 MB). Older unencrypted files are rejected. Supabase sign-in passwords are not included.</p>}
          {message && <p className="backup-success" role="status">{message}</p>}
          {error && <p className="error" role="alert">Backup action failed: {error}</p>}
          <div className="backup-actions">
            <button className="btn primary" type="button" onClick={() => { setKeyError(""); setExportPassphrase(""); setConfirmPassphrase(""); setExportKeyOpen(true); }} disabled={saving || importing}>
              <Download size={16} /> {saving ? "Preparing backup..." : "Download backup"}
            </button>
            {role === "admin" && <>
              <button className="btn" type="button" onClick={() => importInput.current?.click()} disabled={saving || importing}>
                {importing ? "Importing backup..." : "Import backup"}
              </button>
              <input ref={importInput} className="backup-file-input" type="file" accept=".json,application/json" onChange={chooseBackup} />
            </>}
          </div>
        </div>
      </section>
      <Modal title="Encrypt clinic backup" open={exportKeyOpen} onClose={() => { if (!saving) { setExportKeyOpen(false); setExportPassphrase(""); setConfirmPassphrase(""); setKeyError(""); } }} className="staff-modal">
        <form className="stack-form" onSubmit={downloadBackup}>
          <p className="muted">Your backup will be encrypted in this browser with AES-256-GCM. Use at least 12 characters and keep the passphrase safe.</p>
          <label>Backup passphrase<PasswordInput value={exportPassphrase} onChange={(event) => setExportPassphrase(event.target.value)} autoComplete="new-password" required minLength={12} /></label>
          <label>Confirm passphrase<PasswordInput value={confirmPassphrase} onChange={(event) => setConfirmPassphrase(event.target.value)} autoComplete="new-password" required minLength={12} /></label>
          {keyError && <p className="error" role="alert">{keyError}</p>}
          <div className="modal-actions">
            <button className="btn" type="button" disabled={saving} onClick={() => { setExportKeyOpen(false); setExportPassphrase(""); setConfirmPassphrase(""); setKeyError(""); }}>Cancel</button>
            <button className="btn primary" type="submit" disabled={saving}>{saving ? "Encrypting..." : "Encrypt and download"}</button>
          </div>
        </form>
      </Modal>
      <Modal title="Decrypt clinic backup" open={decryptKeyOpen} onClose={() => { if (!decrypting) { setDecryptKeyOpen(false); setEncryptedFile(null); setImportPassphrase(""); setDecryptError(""); } }} className="staff-modal">
        <form className="stack-form" onSubmit={unlockBackup}>
          <p className="muted">Enter the passphrase used when this AES-256-GCM backup was created.</p>
          <label>Backup passphrase<PasswordInput value={importPassphrase} onChange={(event) => setImportPassphrase(event.target.value)} autoComplete="current-password" required /></label>
          {decryptError && <p className="error" role="alert">{decryptError}</p>}
          <div className="modal-actions">
            <button className="btn" type="button" disabled={decrypting} onClick={() => { setDecryptKeyOpen(false); setEncryptedFile(null); setImportPassphrase(""); setDecryptError(""); }}>Cancel</button>
            <button className="btn primary" type="submit" disabled={decrypting}>{decrypting ? "Decrypting..." : "Decrypt backup"}</button>
          </div>
        </form>
      </Modal>
      <Modal title="Import clinic backup?" open={Boolean(pendingImport)} onClose={() => !importing && setPendingImport(null)} className="staff-modal">
        {pendingImport && <div className="backup-import-confirm">
          <p>You are importing <b>{pendingImport.fileName}</b>, created {pendingImport.backup.created_at ? new Date(pendingImport.backup.created_at).toLocaleString() : "at an unknown time"}.</p>
          <p className="muted">Matching record IDs will be updated and missing records will be added. Existing records will not be deleted. Supabase login passwords are not part of backup files.</p>
          <p className="backup-import-count">{TABLES.reduce((sum, table) => sum + pendingImport.backup.tables[table].length, 0).toLocaleString()} records across {TABLES.length} tables</p>
          <div className="modal-actions">
            <button className="btn" type="button" disabled={importing} onClick={() => setPendingImport(null)}>Cancel</button>
            <button className="btn primary" type="button" disabled={importing} onClick={importBackup}>{importing ? "Importing..." : "Import backup"}</button>
          </div>
        </div>}
      </Modal>
    </div>
  );
}
