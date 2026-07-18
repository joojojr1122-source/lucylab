import { useState } from "react";

export function ConsentGate({ onAccept }: { onAccept: () => void }) {
  const [tos, setTos] = useState(false);
  const [noImpersonate, setNoImpersonate] = useState(false);

  return (
    <div className="consent">
      <h2>Before you go live</h2>
      <label className="check">
        <input type="checkbox" checked={tos} onChange={(e) => setTos(e.target.checked)} />
        I have read and agree to the{" "}
        <a href="/terms" target="_blank" rel="noreferrer">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/privacy" target="_blank" rel="noreferrer">
          Privacy Policy
        </a>
        .
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={noImpersonate}
          onChange={(e) => setNoImpersonate(e.target.checked)}
        />
        I will not use avatars to impersonate real people without their consent.
      </label>
      <button className="primary" disabled={!tos || !noImpersonate} onClick={onAccept}>
        I understand — continue
      </button>
      <p className="hint">
        You are responsible for what you stream. Generated faces, characters, and your own
        stylized self are fine; impersonating real individuals is prohibited.
      </p>
    </div>
  );
}
