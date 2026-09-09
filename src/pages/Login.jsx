import { useState } from "react";
import { supabase } from "../lib/supabase.js";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + "/app/leads" } });
    setBusy(false);
    if (error) setErr(error.message); else setSent(true);
  }

  return (
    <div className="login">
      <form className="box" onSubmit={send}>
        <h1>Consortia OS</h1>
        {sent ? (
          <p>Check {email} for a sign-in link. It opens this app already signed in.</p>
        ) : (
          <>
            <p>Sign in with your work email. No password: you get a link.</p>
            <input type="email" required placeholder="you@consortiaadvisory.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            {err && <p className="err">{err}</p>}
            <button className="btn primary" disabled={busy}>{busy ? "Sending…" : "Send sign-in link"}</button>
          </>
        )}
      </form>
    </div>
  );
}
