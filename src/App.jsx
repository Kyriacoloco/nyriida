import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { configured, supabase } from "./lib/supabase.js";
import { ToastProvider } from "./components/ui.jsx";
import Login from "./pages/Login.jsx";
import Leads from "./pages/Leads.jsx";
import Engagements from "./pages/Engagements.jsx";
import EngagementDetail from "./pages/EngagementDetail.jsx";
import Soon from "./pages/Soon.jsx";

const NAV = [
  ["Dashboard", "/app/dashboard", 5],
  ["Leads", "/app/leads"],
  ["Engagements", "/app/engagements"],
  ["Clients", "/app/clients", 5],
  ["Projects", "/app/projects", 4],
  ["Documents", "/app/documents", 5],
  ["Time", "/app/time", 4],
  ["Invoices", "/app/invoices", 3],
  ["Reports", "/app/reports", 5],
  ["Portal preview", "/app/portal", 2],
];

function Shell({ session, staff, signOut }) {
  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="wordmark">Solonos</div>
        {NAV.map(([label, to, slice]) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "active" : "")}>
            {label}{slice && <span className="soon">slice {slice}</span>}
          </NavLink>
        ))}
        <div className="foot">
          {staff?.full_name ?? session.user.email}<br />
          <span style={{ opacity: .7 }}>{staff?.role}</span><br />
          <button onClick={signOut}>Sign out</button>
        </div>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/app/leads" element={<Leads />} />
          <Route path="/app/engagements" element={<Engagements />} />
          <Route path="/app/engagements/:id" element={<EngagementDetail />} />
          <Route path="/app/*" element={<Soon />} />
          <Route path="*" element={<Navigate to="/app/leads" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [staff, setStaff] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setStaff(null); return; }
    supabase.from("staff").select("full_name, role").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => setStaff(data ?? false));
  }, [session]);

  if (!configured) return (
    <div className="login"><div className="box">
      <h1>Not connected</h1>
      <p>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel (or a local .env) and redeploy.</p>
    </div></div>
  );
  if (session === undefined) return null;
  if (!session) return <Login />;
  if (staff === null) return null;
  if (staff === false) return (
    <div className="login"><div className="box">
      <h1>Not staff</h1>
      <p>{session.user.email} is signed in but isn't in the staff table. A partner adds you with one SQL line (README step 4).</p>
      <button className="btn primary" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div></div>
  );

  return (
    <ToastProvider>
      <Shell session={session} staff={staff} signOut={() => supabase.auth.signOut().then(() => nav("/"))} />
    </ToastProvider>
  );
}
