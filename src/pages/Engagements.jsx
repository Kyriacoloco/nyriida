import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { ENGAGEMENT_STAGES, LIVE_STAGES, ago, eur, stageLabel } from "../lib/stages.js";
import { Chip, Empty } from "../components/ui.jsx";

const chipKind = (s) => (s === "declined" ? "danger" : s === "completed" ? "ok" : s === "valuation_active" ? "accent" : "");

export default function Engagements() {
  const nav = useNavigate();
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("live");

  useEffect(() => {
    supabase.from("engagements").select("id, stage, client_name, client_email, company_name, company_country, fee, updated_at, created_at")
      .order("updated_at", { ascending: false })
      .then(({ data }) => setRows(data ?? []));
  }, []);

  const shown = (rows ?? []).filter((r) => filter === "all" ? true : filter === "live" ? LIVE_STAGES.includes(r.stage) : r.stage === filter);
  const counts = Object.fromEntries(ENGAGEMENT_STAGES.map((s) => [s.key, (rows ?? []).filter((r) => r.stage === s.key).length]));

  return (
    <>
      <div className="pagehead">
        <div><h1>Engagements</h1><p>Everyone between Call 1 and "valuation started". Click one to move it along.</p></div>
      </div>
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <button className={`btn ${filter === "live" ? "primary" : ""}`} onClick={() => setFilter("live")}>Live</button>
        {ENGAGEMENT_STAGES.filter((s) => counts[s.key] > 0).map((s) => (
          <button key={s.key} className={`btn ${filter === s.key ? "primary" : ""}`} onClick={() => setFilter(s.key)}>{s.label} · {counts[s.key]}</button>
        ))}
        <button className={`btn ${filter === "all" ? "primary" : ""}`} onClick={() => setFilter("all")}>All</button>
      </div>
      <div className="card">
        {rows === null ? null : shown.length === 0 ? (
          <Empty title="Nothing here">Convert a lead from the Leads board to start an engagement.</Empty>
        ) : (
          <table className="table">
            <thead><tr><th>Client</th><th>Company</th><th>Stage</th><th>Fee</th><th>Updated</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="click" onClick={() => nav(`/app/engagements/${r.id}`)}>
                  <td><strong>{r.client_name}</strong><div className="muted small">{r.client_email}</div></td>
                  <td>{r.company_name || "—"}<div className="muted small">{r.company_country}</div></td>
                  <td><Chip kind={chipKind(r.stage)}>{stageLabel(r.stage)}</Chip></td>
                  <td>{r.fee ? eur(r.fee) : <span className="muted">not set</span>}</td>
                  <td className="muted">{ago(r.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
