import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase, rpc } from "../lib/supabase.js";
import { ENGAGEMENT_STAGES, APPROACHES, INVOICE_NAMES, stageIndex, stageLabel, ago, day, money, eur } from "../lib/stages.js";
import { Card, Chip, Field, useAction, useToast } from "../components/ui.jsx";

export default function EngagementDetail() {
  const { id } = useParams();
  const [e, setE] = useState(null);
  const [deposit, setDeposit] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [docs, setDocs] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [feed, setFeed] = useState([]);

  const load = useCallback(async () => {
    const [a, b, c, d, f, g] = await Promise.all([
      supabase.from("engagements").select("*").eq("id", id).single(),
      supabase.from("deposits").select("*").eq("engagement_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("engagement_invoices").select("*").eq("engagement_id", id).order("seq"),
      supabase.from("client_documents").select("*").eq("engagement_id", id).order("created_at"),
      supabase.from("agreements").select("id, kind, version, status, sent_at, signed_at").eq("engagement_id", id).order("created_at"),
      supabase.from("activity_log").select("*").eq("engagement_id", id).order("created_at", { ascending: false }).limit(40),
    ]);
    setE(a.data); setDeposit(b.data); setInvoices(c.data ?? []); setDocs(d.data ?? []); setAgreements(f.data ?? []); setFeed(g.data ?? []);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (!e) return null;
  const idx = stageIndex(e.stage);
  const st = ENGAGEMENT_STAGES[idx];
  const canDecline = !["engaged", "valuation_active", "completed", "declined"].includes(e.stage);

  return (
    <>
      <div className="pagehead">
        <div>
          <div className="muted small"><Link to="/app/engagements">Engagements</Link> / {e.company_name || e.client_name}</div>
          <h1>{e.company_name || e.client_name}</h1>
          <p>{e.client_name}{e.client_title ? `, ${e.client_title}` : ""} · {e.client_email}</p>
        </div>
        <Chip kind={e.stage === "declined" ? "danger" : e.stage === "completed" ? "ok" : "brand"}>{stageLabel(e.stage)}</Chip>
      </div>

      <Stepper stage={e.stage} />

      <div className="grid2" style={{ marginTop: 18 }}>
        <div className="stack" style={{ gap: 16 }}>
          <NextStep e={e} st={st} deposit={deposit} docs={docs} invoices={invoices} agreements={agreements} reload={load} />
          {["docs_pending", "review_pending", "proposal", "engaged", "valuation_active", "completed"].includes(e.stage) && (
            <Checklist e={e} docs={docs} reload={load} />
          )}
          {canDecline && <DeclineBox e={e} reload={load} />}
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <ClientDetails e={e} reload={load} />
          <Invoices invoices={invoices} deposit={deposit} reload={load} />
          <Card title="Activity">
            {feed.length === 0 ? <span className="muted small">Nothing yet.</span> : (
              <ul className="feed">
                {feed.map((f) => (
                  <li key={f.id}><span className="when">{ago(f.created_at)}</span><span>{describe(f)}</span></li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Stepper({ stage }) {
  const idx = stageIndex(stage);
  const steps = ENGAGEMENT_STAGES.slice(0, 8);
  return (
    <div className="stepper">
      {steps.map((s, i) => {
        const cls = stage === "declined" ? (i < 7 ? "declined" : "") : i < idx ? "done" : i === idx ? "now" : "";
        return <div key={s.key} className={`step ${cls}`}>{s.label}</div>;
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- next step by stage */
function NextStep({ e, st, deposit, docs, invoices, agreements, reload }) {
  const [run, busy] = useAction();
  const toast = useToast();

  const advance = (to) => run(() => rpc("staff_advance_engagement", { p_id: e.id, p_to: to }).then(reload), `Moved to ${stageLabel(to)}`);

  const body = (() => {
    switch (e.stage) {
      case "deposit_pending": return <DepositStep e={e} deposit={deposit} reload={reload} />;
      case "nda_pending": return <AgreementStep kind="nda" label="NDA" agreements={agreements} />;
      case "docs_pending": return (
        <p className="small" style={{ margin: 0 }}>
          The client uploads against the checklist below. When the last required item is in, this moves to Review on its own.
          {docs.length === 0 && <> <strong>Add the checklist items first</strong> or the client sees an empty page.</>}
        </p>
      );
      case "review_pending": return <Call2Step e={e} reload={reload} />;
      case "proposal": return <ProposalStep e={e} reload={reload} agreements={agreements} />;
      case "engaged": return (
        <p className="small" style={{ margin: 0 }}>
          Invoice 1 is issued (right). When the bank transfer lands, mark it paid there, then start the valuation.
        </p>
      );
      case "valuation_active": return <p className="small" style={{ margin: 0 }}>Project created. The Projects screen arrives in slice 4.</p>;
      case "completed": return <p className="small" style={{ margin: 0 }}>Done. Invoice 2 paid, project closed.</p>;
      case "declined": return <p className="small" style={{ margin: 0 }}>Declined{e.declined_reason ? `: ${e.declined_reason}` : ""}. Deposit refunded if it had been paid.</p>;
      default: return null;
    }
  })();

  return (
    <Card title={`Now: ${stageLabel(e.stage)}`} right={st?.next && (
      <button className="btn primary" disabled={busy} onClick={() => advance(st.next)}>{st.nextLabel}</button>
    )}>
      {body}
      {st?.next && <p className="muted small" style={{ margin: "12px 0 0" }}>Unlocks when: {st.gate}.</p>}
    </Card>
  );
}

function DepositStep({ e, deposit, reload }) {
  const [run, busy] = useAction();
  const toast = useToast();
  async function getLink() {
    await run(async () => {
      const { data, error } = await supabase.functions.invoke("create-deposit-checkout", { body: { engagement_id: e.id } });
      if (error) throw new Error((await error.context?.json?.())?.error ?? error.message);
      if (data?.error) throw new Error(data.error);
      await reload();
    }, "Payment link ready");
  }
  const copy = () => navigator.clipboard.writeText(deposit.checkout_url).then(() => toast("Link copied"));
  const [ref, setRef] = useState("");
  const [bank, setBank] = useState(false);
  const recordBank = () => run(() => rpc("staff_record_deposit_paid", { p_engagement: e.id, p_reference: ref || null }).then(reload), "Deposit recorded, moved to NDA");
  return (
    <div className="stack">
      <p className="small" style={{ margin: 0 }}>
        The client pays the €500 deposit by bank transfer (details are on the deposit invoice) or, once Stripe is connected, by card.
        Either way this moves to NDA when the money is in.
      </p>
      {deposit?.checkout_url ? (
        <div className="row">
          <input readOnly value={deposit.checkout_url} style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} />
          <button className="btn" onClick={copy}>Copy</button>
          <a className="btn" href={deposit.checkout_url} target="_blank" rel="noreferrer">Open</a>
        </div>
      ) : bank ? (
        <div className="row">
          <input placeholder="Bank reference (optional)" value={ref} onChange={(x) => setRef(x.target.value)} style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--border)" }} />
          <button className="btn primary" disabled={busy} onClick={recordBank}>Confirm €500 received</button>
          <button className="btn" onClick={() => setBank(false)}>Cancel</button>
        </div>
      ) : (
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={() => setBank(true)}>Record bank transfer</button>
          <button className="btn" disabled={busy} onClick={getLink} title="Needs the Stripe key set in the backend">Create Stripe link</button>
        </div>
      )}
      <div className="muted small">Deposit status: {deposit?.status ?? "no deposit row"}{deposit?.paid_at && ` · paid ${day(deposit.paid_at)}`}{deposit?.method === "bank_transfer" && " by bank transfer"}</div>
    </div>
  );
}

function AgreementStep({ kind, label, agreements }) {
  const a = agreements.filter((x) => x.kind === kind).at(-1);
  return (
    <div className="stack">
      {a ? (
        <div className="small">{label} v{a.version}: <Chip kind={a.status === "signed" ? "ok" : "warn"}>{a.status}</Chip>{a.sent_at && ` sent ${day(a.sent_at)}`}{a.signed_at && ` · signed ${day(a.signed_at)}`}</div>
      ) : (
        <div className="note">Generating the {label} from the locked template and sending it to the portal arrives in slice 2. Until then this stage waits.</div>
      )}
    </div>
  );
}

function Call2Step({ e, reload }) {
  const [run, busy] = useAction();
  const [url, setUrl] = useState(e.call2_fathom_url ?? "");
  const [when, setWhen] = useState(e.call2_held_at ? e.call2_held_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
  async function save() {
    await run(async () => {
      const { error } = await supabase.from("engagements").update({ call2_fathom_url: url || null, call2_held_at: new Date(when).toISOString() }).eq("id", e.id);
      if (error) throw new Error(error.message);
      await reload();
    }, "Call 2 recorded");
  }
  return (
    <div className="stack">
      <p className="small" style={{ margin: 0 }}>Prepare the six-page review from the uploads, hold Call 2, then record it here. Then move to Proposal.</p>
      <div className="grid2">
        <Field label="Date of Call 2"><input type="date" value={when} onChange={(x) => setWhen(x.target.value)} /></Field>
        <Field label="Fathom link (optional)"><input value={url} onChange={(x) => setUrl(x.target.value)} placeholder="https://fathom.video/…" /></Field>
      </div>
      <div className="row">
        <button className="btn" disabled={busy} onClick={save}>{e.call2_held_at ? "Update Call 2" : "Record Call 2"}</button>
        {e.call2_held_at && <span className="muted small">recorded {day(e.call2_held_at)}</span>}
      </div>
    </div>
  );
}

function ProposalStep({ e, reload, agreements }) {
  const [run, busy] = useAction();
  const [fee, setFee] = useState(e.fee ?? "");
  const [appr, setAppr] = useState(e.approaches ?? []);
  const toggle = (k) => setAppr((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));
  async function save() {
    await run(async () => {
      const { error } = await supabase.from("engagements").update({ fee: Number(fee), approaches: appr }).eq("id", e.id);
      if (error) throw new Error(error.message);
      await reload();
    }, "Terms saved");
  }
  const half = Math.min(Number(fee || 0) * 0.5, 5000);
  return (
    <div className="stack">
      <p className="small" style={{ margin: 0 }}>Set the fee and approaches, save, then generate the letter. Signing moves this to Engaged and issues Invoice 1.</p>
      <div className="grid2">
        <Field label="Total fee (EUR, no VAT)"><input type="number" min="0" step="100" value={fee} onChange={(x) => setFee(x.target.value)} /></Field>
        <div className="note" style={{ alignSelf: "end" }}>
          Invoice 1: <strong>{eur(Math.max(half - 500, 0))}</strong> on signing · Invoice 2: <strong>{eur(Math.max(Number(fee || 0) - half, 0))}</strong> on final report · €500 deposit credited
        </div>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        {APPROACHES.map((a) => (
          <label key={a.key} className="check"><input type="checkbox" checked={appr.includes(a.key)} onChange={() => toggle(a.key)} />{a.label}</label>
        ))}
      </div>
      <div className="row">
        <button className="btn" disabled={busy || !fee || appr.length === 0} onClick={save}>Save terms</button>
        <span className="muted small">{e.fee ? `saved: ${eur(e.fee)}, ${(e.approaches ?? []).length} approach(es)` : "not saved yet"}</span>
      </div>
      <AgreementStep kind="engagement_letter" label="Engagement letter" agreements={agreements} />
    </div>
  );
}

/* ---------------------------------------------------------------- checklist */
function Checklist({ e, docs, reload }) {
  const [run, busy] = useAction();
  const [label, setLabel] = useState("");
  const [required, setRequired] = useState(true);
  const locked = !["docs_pending", "review_pending"].includes(e.stage);

  const add = () => run(async () => {
    const { error } = await supabase.from("client_documents").insert({ engagement_id: e.id, label, required });
    if (error) throw new Error(error.message);
    setLabel(""); await reload();
  });
  const remove = (id) => run(async () => {
    const { error } = await supabase.from("client_documents").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await reload();
  });
  const received = (id) => run(async () => {
    const { data: me } = await supabase.auth.getUser();
    const { error } = await supabase.from("client_documents").update({ uploaded_at: new Date().toISOString(), uploaded_by: `staff:${me.user.email}` }).eq("id", id);
    if (error) throw new Error(error.message);
    await reload();
  }, "Marked received");

  const presets = ["Audited financial statements, last 3 years", "Management accounts, year to date", "Budget / forecast", "Debt and lease schedule", "Fixed asset register", "Cap table / shareholder register"];

  return (
    <Card title="Financials checklist" right={<span className="muted small">{docs.filter((d) => d.uploaded_at).length}/{docs.length} in</span>}>
      {docs.length === 0 && <p className="muted small" style={{ marginTop: 0 }}>What the client must upload. The stage moves on when every required item is in.</p>}
      <div className="stack" style={{ gap: 6 }}>
        {docs.map((d) => (
          <div key={d.id} className="row between small" style={{ padding: "6px 0", borderBottom: "1px solid var(--border-sub)" }}>
            <span>{d.uploaded_at ? "✓ " : "○ "}{d.label} {!d.required && <Chip>optional</Chip>}</span>
            <span className="row">
              {d.uploaded_at ? <span className="muted">{ago(d.uploaded_at)}{d.uploaded_by?.startsWith("staff:") && " · by staff"}</span> : (
                <>
                  <button className="btn" disabled={busy} onClick={() => received(d.id)} title="Client sent it another way">Mark received</button>
                  {!locked && <button className="btn" disabled={busy} onClick={() => remove(d.id)}>Remove</button>}
                </>
              )}
            </span>
          </div>
        ))}
      </div>
      {!locked && (
        <div className="stack" style={{ marginTop: 12 }}>
          <div className="row">
            <input list="presets" placeholder="Add an item, e.g. Audited FS 2025" value={label} onChange={(x) => setLabel(x.target.value)} style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--border)" }} />
            <datalist id="presets">{presets.map((p) => <option key={p} value={p} />)}</datalist>
            <label className="check"><input type="checkbox" checked={required} onChange={(x) => setRequired(x.target.checked)} />required</label>
            <button className="btn" disabled={!label || busy} onClick={add}>Add</button>
          </div>
          {docs.length === 0 && (
            <div className="row wrap">{presets.slice(0, 4).map((p) => <button key={p} className="btn" disabled={busy} onClick={() => { setLabel(p); }}>{p}</button>)}</div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- decline */
function DeclineBox({ e, reload }) {
  const [run, busy] = useAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const decline = () => run(async () => {
    const { error } = await supabase.from("engagements").update({ declined_reason: reason }).eq("id", e.id);
    if (error) throw new Error(error.message);
    await rpc("staff_advance_engagement", { p_id: e.id, p_to: "declined" });
    await reload(); setOpen(false);
  }, "Declined. Deposit refunded if it was paid.");
  return open ? (
    <Card title="Decline this engagement">
      <div className="stack">
        <Field label="Why? (feeds the conversion report)"><textarea rows={2} value={reason} onChange={(x) => setReason(x.target.value)} placeholder="e.g. Price too high, went with local accountant, timing" /></Field>
        <div className="row">
          <button className="btn danger" disabled={busy || !reason} onClick={decline}>Decline and refund deposit</button>
          <button className="btn" onClick={() => setOpen(false)}>Keep it</button>
        </div>
      </div>
    </Card>
  ) : (
    <div><button className="btn link small" onClick={() => setOpen(true)}>Client walked away? Decline this engagement</button></div>
  );
}

/* ---------------------------------------------------------------- client details */
function ClientDetails({ e, reload }) {
  const [run, busy] = useAction();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({});
  const start = () => { setF({ client_name: e.client_name, client_title: e.client_title ?? "", client_email: e.client_email, company_name: e.company_name ?? "", company_address: e.company_address ?? "", company_country: e.company_country ?? "", company_tax_id: e.company_tax_id ?? "", is_individual: e.is_individual }); setEdit(true); };
  const save = () => run(async () => {
    const { error } = await supabase.from("engagements").update(f).eq("id", e.id);
    if (error) throw new Error(error.message);
    await reload(); setEdit(false);
  }, "Saved");
  const set = (k) => (x) => setF({ ...f, [k]: x.target.type === "checkbox" ? x.target.checked : x.target.value });

  if (edit) return (
    <Card title="Client details" right={<div className="row"><button className="btn" onClick={() => setEdit(false)}>Cancel</button><button className="btn primary" disabled={busy} onClick={save}>Save</button></div>}>
      <div className="stack">
        <Field label="Signatory name"><input value={f.client_name} onChange={set("client_name")} /></Field>
        <div className="grid2">
          <Field label="Title (e.g. Director)"><input value={f.client_title} onChange={set("client_title")} /></Field>
          <Field label="Email (portal login)"><input type="email" value={f.client_email} onChange={set("client_email")} /></Field>
        </div>
        <label className="check"><input type="checkbox" checked={f.is_individual} onChange={set("is_individual")} />Contracting as an individual, not a company</label>
        <Field label="Company name"><input value={f.company_name} onChange={set("company_name")} /></Field>
        <Field label="Registered address"><textarea rows={2} value={f.company_address} onChange={set("company_address")} /></Field>
        <div className="grid2">
          <Field label="Country (drives NDA law and invoicing entity)"><input value={f.company_country} onChange={set("company_country")} /></Field>
          <Field label="Tax / registration no."><input value={f.company_tax_id} onChange={set("company_tax_id")} /></Field>
        </div>
      </div>
    </Card>
  );
  const missing = [!e.company_address && "address", !e.company_country && "country", !e.client_title && "title"].filter(Boolean);
  return (
    <Card title="Client details" right={<button className="btn" onClick={start}>Edit</button>}>
      <dl className="kv">
        <dt>Signatory</dt><dd>{e.client_name}{e.client_title && `, ${e.client_title}`}</dd>
        <dt>Email</dt><dd>{e.client_email}</dd>
        <dt>Company</dt><dd>{e.is_individual ? "Individual" : e.company_name || "—"}</dd>
        <dt>Address</dt><dd style={{ whiteSpace: "pre-line" }}>{e.company_address || "—"}</dd>
        <dt>Country</dt><dd>{e.company_country || "—"}</dd>
        <dt>Tax no.</dt><dd>{e.company_tax_id || "—"}</dd>
        <dt>Invoiced by</dt><dd>{entityFor(e.company_country)}</dd>
      </dl>
      {missing.length > 0 && <div className="note" style={{ marginTop: 10 }}>The NDA needs {missing.join(", ")}. Fill it in before slice 2 generates documents.</div>}
    </Card>
  );
}

const entityFor = (c = "") => ["gb", "uk", "gbr", "united kingdom", "great britain", "england", "scotland", "wales", "northern ireland"].includes(c.trim().toLowerCase()) ? "Consortia Ltd (Cyprus)" : "Consortia Advisory LLP (UK)";

/* ---------------------------------------------------------------- invoices */
function Invoices({ invoices, reload }) {
  const [run, busy] = useAction();
  const paid = (id) => run(() => rpc("staff_mark_invoice_paid", { p_invoice: id }).then(reload), "Marked paid");
  const kind = (s) => ({ paid: "ok", issued: "warn", refunded: "", void: "", scheduled: "" })[s];
  return (
    <Card title="Invoices">
      {invoices.length === 0 ? <span className="muted small">None yet.</span> : (
        <table className="table">
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id}>
                <td>
                  <div>{INVOICE_NAMES[i.seq]}</div>
                  <div className="muted small">{i.invoice_no ? `${i.issuing_entity} #${i.invoice_no}` : "not numbered"}{i.due_at && ` · due ${day(i.due_at)}`}</div>
                </td>
                <td style={{ textAlign: "right" }}>{money(i.amount, i.currency)}</td>
                <td style={{ textAlign: "right" }}>
                  {i.status === "issued" && i.seq > 0 ? <button className="btn" disabled={busy} onClick={() => paid(i.id)}>Mark paid</button> : <Chip kind={kind(i.status)}>{i.status}</Chip>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted small" style={{ margin: "8px 0 0" }}>All three are bank transfers unless Stripe is connected: mark them paid when the money lands. PDFs arrive in slice 3.</p>
    </Card>
  );
}

/* ---------------------------------------------------------------- activity copy */
function describe(f) {
  const d = f.detail ?? {};
  switch (f.action) {
    case "engagement.created": return "Engagement created from lead";
    case "engagement.stage": return `Moved to ${stageLabel(d.to)}`;
    case "deposit.link_created": return "Stripe deposit link created";
    case "deposit.paid": return `Deposit received by ${d.method === "bank_transfer" ? "bank transfer" : "card"}${d.reference ? ` (${d.reference})` : ""}`;
    case "invoice.issued": return `${INVOICE_NAMES[d.seq]} issued, #${d.no}, ${eur(d.amount)}`;
    case "invoice.paid": return `${INVOICE_NAMES[d.seq]} paid`;
    case "agreement.signed": return `${d.kind === "nda" ? "NDA" : "Engagement letter"} v${d.version} signed by ${f.actor}`;
    case "project.created": return `Project ${d.code} created`;
    case "project.stage": return `Project moved to ${d.to}`;
    default: return f.action;
  }
}
