import { Fragment, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, rpc } from "../lib/supabase.js";
import { ago, eur } from "../lib/stages.js";
import { Drawer, Empty, Field, Chip, useAction } from "../components/ui.jsx";

export default function Leads() {
  const [stages, setStages] = useState([]);
  const [leads, setLeads] = useState([]);
  const [engByOpp, setEngByOpp] = useState({});
  const [lastSync, setLastSync] = useState(null);
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    const [s, l, e, sy] = await Promise.all([
      supabase.from("pipeline_stages").select("*").order("position"),
      supabase.from("leads_board").select("*").order("ghl_updated_at", { ascending: false }),
      supabase.from("engagements").select("id, opportunity_id, stage").not("opportunity_id", "is", null),
      supabase.from("sync_log").select("received_at, ok, kind").eq("ok", true).order("id", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setStages(s.data ?? []);
    setLeads(l.data ?? []);
    setEngByOpp(Object.fromEntries((e.data ?? []).map((x) => [x.opportunity_id, x])));
    setLastSync(sy.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (stages.length === 0) return (
    <>
      <Head lastSync={lastSync} />
      <Empty title="No pipeline yet">
        Run the first GHL pull (README step 2) and the stages appear here, in the same order as GHL.
      </Empty>
    </>
  );

  return (
    <>
      <Head lastSync={lastSync} count={leads.length} />
      <div className="board">
        {stages.map((st) => {
          const rows = leads.filter((l) => l.stage_id === st.ghl_id);
          return (
            <div className="col" key={st.ghl_id}>
              <h3>{st.name}<span>{rows.length}</span></h3>
              {rows.map((l) => (
                <div className="lead" key={l.ghl_id} onClick={() => setOpen(l)}>
                  <div className="name">{l.name}</div>
                  <div className="meta">
                    <span>{l.company || [l.first_name, l.last_name].filter(Boolean).join(" ")}</span>
                    <span>{ago(l.ghl_updated_at)}</span>
                  </div>
                  <div className="row" style={{ marginTop: 6, gap: 6 }}>
                    {l.country && <Chip>{l.country}</Chip>}
                    {l.monetary_value > 0 && <Chip>{eur(l.monetary_value)}</Chip>}
                    {l.recordings > 0 && <Chip>Fathom ×{l.recordings}</Chip>}
                    {engByOpp[l.ghl_id] && <Chip kind="accent">engagement</Chip>}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {open && <LeadDrawer lead={open} engagement={engByOpp[open.ghl_id]} onClose={() => setOpen(null)} reload={load} />}
    </>
  );
}

/** The GHL intake form answers (custom fields). Meta ad ids are hidden; everything else is shown. */
export function Intake({ custom, title = "Intake form" }) {
  const rows = Object.entries(custom ?? {}).filter(([k]) => !/meta (campaign|ad set|ad) id/i.test(k));
  if (rows.length === 0) return null;
  return (
    <>
      {title && <h3>{title}</h3>}
      <dl className="kv" style={{ margin: "8px 0 18px" }}>
        {rows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{String(v)}</dd></Fragment>)}
      </dl>
    </>
  );
}

function Head({ lastSync, count }) {
  return (
    <div className="pagehead">
      <div><h1>Leads</h1><p>Your GHL pipeline, mirrored. Move leads in GHL; they move here within seconds.</p></div>
      <div className="muted small">
        {count != null && `${count} open · `}
        {lastSync ? `last sync ${ago(lastSync.received_at)}` : "never synced"}
      </div>
    </div>
  );
}

function LeadDrawer({ lead, engagement, onClose, reload }) {
  const nav = useNavigate();
  const [run, busy] = useAction();
  const [recs, setRecs] = useState([]);
  const [fathom, setFathom] = useState("");
  const [callNo, setCallNo] = useState(1);
  const [convert, setConvert] = useState(false);
  const [name, setName] = useState([lead.first_name, lead.last_name].filter(Boolean).join(" "));
  const [email, setEmail] = useState(lead.email ?? "");

  const loadRecs = useCallback(async () => {
    const { data } = await supabase.from("call_recordings").select("*").eq("opportunity_id", lead.ghl_id).order("call_no");
    setRecs(data ?? []);
  }, [lead.ghl_id]);
  useEffect(() => { loadRecs(); }, [loadRecs]);

  async function addFathom() {
    await run(async () => {
      const { error } = await supabase.from("call_recordings").insert({ opportunity_id: lead.ghl_id, call_no: callNo, fathom_url: fathom, recorded_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
      setFathom(""); await loadRecs(); await reload();
    }, "Recording attached");
  }

  async function doConvert() {
    await run(async () => {
      const e = await rpc("staff_create_engagement", { p_opportunity: lead.ghl_id, p_client_name: name, p_client_email: email });
      nav(`/app/engagements/${e.id}`);
    });
  }

  return (
    <Drawer title={lead.name} sub={lead.stage_name} onClose={onClose}>
      <dl className="kv" style={{ margin: "14px 0" }}>
        <dt>Contact</dt><dd>{[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—"}</dd>
        <dt>Company</dt><dd>{lead.company || "—"}</dd>
        <dt>Email</dt><dd>{lead.email || "—"}</dd>
        <dt>Phone</dt><dd>{lead.phone || "—"}</dd>
        <dt>Country</dt><dd>{lead.country || "—"}</dd>
        <dt>Source</dt><dd>{lead.source || "—"}</dd>
        <dt>Owner</dt><dd>{lead.assigned_to || "—"}</dd>
      </dl>

      <Intake custom={lead.custom} />

      <h3>Call recordings</h3>
      <div className="stack" style={{ margin: "8px 0 18px" }}>
        {recs.length === 0 && <span className="muted small">None yet. Paste the Fathom link after each call.</span>}
        {recs.map((r) => <div key={r.id} className="row between small"><span>Call {r.call_no}</span><a href={r.fathom_url} target="_blank" rel="noreferrer">Open in Fathom</a></div>)}
        <div className="row">
          <select value={callNo} onChange={(e) => setCallNo(Number(e.target.value))} style={{ padding: 8, borderRadius: 8, border: "1px solid var(--border)" }}>
            <option value={1}>Call 1</option><option value={2}>Call 2</option>
          </select>
          <input placeholder="https://fathom.video/…" value={fathom} onChange={(e) => setFathom(e.target.value)} style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--border)" }} />
          <button className="btn" disabled={!fathom || busy} onClick={addFathom}>Attach</button>
        </div>
      </div>

      {engagement ? (
        <div className="note">
          This lead already has an engagement. <button className="btn link" onClick={() => nav(`/app/engagements/${engagement.id}`)}>Open it</button>
        </div>
      ) : convert ? (
        <div className="stack">
          <h3>Convert to engagement</h3>
          <p className="muted small" style={{ margin: 0 }}>Creates the engagement and the €500 deposit invoice. The Stripe link comes on the next screen.</p>
          <Field label="Signatory full name (as it will appear on the NDA)"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Signatory email (their portal login)"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <div className="row">
            <button className="btn primary" disabled={!name || !email || busy} onClick={doConvert}>Create engagement</button>
            <button className="btn" onClick={() => setConvert(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="btn primary" onClick={() => setConvert(true)}>Convert to engagement</button>
      )}
    </Drawer>
  );
}
