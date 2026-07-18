import type { ServerStatus } from "../hooks/useStatus";

export function StatusBanner({ status }: { status: ServerStatus | null }) {
  if (!status) return null;

  const missing: string[] = [];
  if (!status.fal) missing.push("FAL_KEY (Lucy transform — blocks Broadcast & Call)");
  if (!status.livekit) missing.push("LiveKit keys (multi-party Call)");
  if (!status.stripe) missing.push("Stripe keys (paid top-ups — free credits still work)");
  if (!status.redis) missing.push("REDIS_URL (balances reset on restart)");

  if (missing.length === 0) return null;

  return (
    <div className="status-banner">
      <strong>Setup incomplete.</strong> Add the following to <code>.env</code>:
      <ul>
        {missing.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}
