import type { AuthUser } from "../hooks/useAuth";

export function AccountMenu({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  return (
    <div className="account">
      <span className="avatar">{user.email.slice(0, 1).toUpperCase()}</span>
      <span className="email">{user.email}</span>
      <span className={`vbadge ${user.verified ? "ok" : "warn"}`}>
        {user.verified ? "Verified" : "Unverified"}
      </span>
      <button className="topup" onClick={onLogout}>
        Log out
      </button>
    </div>
  );
}

export function VerifyPrompt({ onVerify }: { onVerify: () => void }) {
  return (
    <div className="verify-prompt">
      <div className="verify-card">
        <h2>Verify your identity</h2>
        <p>
          Before you can broadcast, we verify your identity. This prevents impersonation and
          keeps the community safe. It takes about a minute (ID + selfie via Stripe Identity).
        </p>
        <button className="primary" onClick={onVerify}>
          Start verification
        </button>
      </div>
    </div>
  );
}
