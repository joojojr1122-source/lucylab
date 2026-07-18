import { useEffect, useState } from "react";
import type { UsageState } from "../hooks/useUsage";

declare global {
  interface Window {
    Stripe?: (key: string) => any;
  }
}

const STRIPE_PUB_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";

export function TopUpModal({
  open,
  onClose,
  usage,
  onTopup,
  onPaid,
}: {
  open: boolean;
  onClose: () => void;
  usage: UsageState;
  onTopup: (minutes: number) => Promise<{ clientSecret?: string; error?: string }>;
  onPaid: () => void;
}) {
  const [minutes, setMinutes] = useState(10);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [card, setCard] = useState<HTMLDivElement | null>(null);
  const [elements, setElements] = useState<any>(null);

  const tiers = usage.topupTiers || { 10: 25, 30: 60, 60: 100, 120: 180 };

  useEffect(() => {
    if (!open || !STRIPE_PUB_KEY) return;
    let mounted = true;
    const s = document.createElement("script");
    s.src = "https://js.stripe.com/v3/";
    s.onload = () => {
      if (!mounted) return;
      const stripe = window.Stripe?.(STRIPE_PUB_KEY);
      if (!stripe) return;
      const e = stripe.elements();
      const c = e.create("payment");
      setElements({ stripe, e, card: c });
      c.mount(card);
    };
    document.body.appendChild(s);
    return () => {
      mounted = false;
      s.remove();
      try {
        elements?.card?.unmount();
      } catch {
        /* noop */
      }
    };
  }, [open]);

  if (!open) return null;

  const pay = async () => {
    setBusy(true);
    setErr(undefined);
    const { clientSecret, error } = await onTopup(minutes);
    if (error || !clientSecret) {
      setErr(error || "failed to start payment");
      setBusy(false);
      return;
    }
    if (!elements) {
      setErr("Stripe not loaded");
      setBusy(false);
      return;
    }
    const { error: confirmErr } = await elements.stripe.confirmPayment({
      elements: elements.e,
      clientSecret,
      redirect: "if_required",
    });
    if (confirmErr) {
      setErr(confirmErr.message || "payment failed");
      setBusy(false);
    } else {
      onPaid();
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Top up credits</h2>
        <p className="hint">
          ${usage.ratePerSecond}/sec · ${(usage.ratePerSecond * 60).toFixed(2)}/min
        </p>
        <div className="tiers">
          {Object.entries(tiers).map(([m, price]) => (
            <button
              key={m}
              className={Number(m) === minutes ? "tier active" : "tier"}
              onClick={() => setMinutes(Number(m))}
            >
              {m} min — ${price}
            </button>
          ))}
        </div>
        <div ref={setCard} className="stripe-card" />
        {!STRIPE_PUB_KEY && (
          <p className="hint">Set VITE_STRIPE_PUBLISHABLE_KEY to enable card payment.</p>
        )}
        {err && <span className="err">{err}</span>}
        <div className="modal-actions">
          <button className="leave" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy || !STRIPE_PUB_KEY} onClick={pay}>
            {busy ? "Processing…" : `Pay $${tiers[minutes]}`}
          </button>
        </div>
      </div>
    </div>
  );
}
