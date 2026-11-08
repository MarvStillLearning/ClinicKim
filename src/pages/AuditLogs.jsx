import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { dateTime } from "../lib/format";
import Pagination from "../components/Pagination";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    async function loadLogs() {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      const auditRows = data || [];
      const actorIds = [...new Set(auditRows.map((log) => log.actor_id).filter(Boolean))];
      let profileById = {};
      if (actorIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .in("id", actorIds);
        if (!profileError) {
          profileById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
        }
      }

      setLogs(auditRows.map((log) => ({ ...log, profiles: profileById[log.actor_id] || null })));
      setLoading(false);
    }

    loadLogs();
  }, []);

  const shown = logs.filter((log) =>
    !filter || `${log.action} ${log.table_name} ${log.record_id || ""}`.toLowerCase().includes(filter.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(shown.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedShown = shown.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => { setPage(1); }, [filter]);

  return (
    <div>
      <div className="page-header">
        <div><h1>Audit Log</h1><p className="muted">Sensitive patient, staff, and sales activity</p></div>
      </div>
      <div className="card">
        <div className="search" style={{ marginBottom: 12 }}>
          <input placeholder="Search action, table, or record ID..." value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        {message && <p className="error">{message}</p>}
        {loading ? <p className="muted">Loading audit trail...</p> : shown.length === 0 ? <p className="muted">No audit entries found.</p> : (
          <table>
            <thead><tr><th>#</th><th>Date & time</th><th>User</th><th>Action</th><th>Table</th><th>Record ID</th></tr></thead>
            <tbody>
              {pagedShown.map((log, index) => (
                <tr key={log.id}>
                  <td><b>{(currentPage - 1) * pageSize + index + 1}</b></td>
                  <td>{dateTime(log.created_at)}</td>
                  <td>{log.profiles?.full_name || log.profiles?.email || "System / unknown"}</td>
                  <td><span className={`tag ${log.action === "DELETE" ? "red" : log.action === "UPDATE" ? "blue" : "green"}`}>{log.action}</span></td>
                  <td>{log.table_name}</td>
                  <td>{log.record_id || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} setPage={setPage} totalItems={shown.length} pageSize={pageSize} />
      </div>
    </div>
  );
}
