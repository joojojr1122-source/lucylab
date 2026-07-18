import { useState } from "react";

export function AuthForms({
  onLogin,
  onRegister,
  onGoogle,
  googleEnabled,
  emailUnverified,
}: {
  onLogin: (e: string, p: string) => Promise<void>;
  onRegister: (e: string, p: string) => Promise<void>;
  onGoogle: () => void;
  googleEnabled: boolean;
  emailUnverified?: boolean;
}) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string>();
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(undefined);
    try {
      if (mode === "register") {
        await onRegister(email, password);
        setSent(true);
      } else {
        await onLogin(email, password);
      }
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  };

  if (sent) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <h1>Check your email</h1>
          <p className="sub">
            We sent a verification link to <strong>{email}</strong>. Click it to activate your
            account, then come back and log in.
          </p>
          <button className="link" type="button" onClick={() => setSent(false)}>
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <h1>Lucy</h1>
        <p className="sub">{mode === "register" ? "Create your account" : "Welcome back"}</p>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {emailUnverified && (
          <span className="err">Verify your email first. Check your inbox (or server console in dev).</span>
        )}
        {err && <span className="err">{err}</span>}
        <button className="primary" type="submit">
          {mode === "register" ? "Create account" : "Log in"}
        </button>
        {googleEnabled && (
          <button type="button" className="google-btn" onClick={onGoogle}>
            <span className="g">G</span> Continue with Google
          </button>
        )}
        <button
          type="button"
          className="link"
          onClick={() => setMode(mode === "register" ? "login" : "register")}
        >
          {mode === "register" ? "Have an account? Log in" : "Need an account? Register"}
        </button>
      </form>
    </div>
  );
}
