import { useCallback, useEffect, useState } from "react";

export interface UsageState {
  secondsRemaining: number;
  ratePerSecond: number;
  sessionId?: string;
  topupTiers?: Record<string, number>;
}

export function useUsage() {
  const [usage, setUsage] = useState<UsageState>({ secondsRemaining: 0, ratePerSecond: 0.05 });
  const [sessionId, setSessionId] = useState<string>();
  const [consent, setConsent] = useState(false);

  const refreshConsent = useCallback(async () => {
    try {
      const d = await (await fetch("/api/consent", { credentials: "include" })).json();
      setConsent(Boolean(d.accepted));
    } catch {
      setConsent(false);
    }
  }, []);

  const acceptConsent = useCallback(async () => {
    try {
      await fetch("/api/consent", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setConsent(true);
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const d = await (
        await fetch("/api/usage", { credentials: "include" })
      ).json();
      setUsage({
        secondsRemaining: d.secondsRemaining,
        ratePerSecond: d.ratePerSecond,
        topupTiers: d.topupTiers,
      });
    } catch {
      /* ignore */
    }
  }, []);

  const start = useCallback(async (): Promise<string | undefined> => {
    try {
      const d = await (
        await fetch("/api/usage/start", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      ).json();
      if (d.error) {
        setUsage((u) => ({ ...u, secondsRemaining: 0 }));
        return undefined;
      }
      setUsage((u) => ({ ...u, secondsRemaining: d.secondsRemaining, sessionId: d.sessionId }));
      setSessionId(d.sessionId);
      return d.sessionId as string;
    } catch {
      return undefined;
    }
  }, []);

  const stop = useCallback(async (id?: string) => {
    if (!id) return;
    try {
      await fetch("/api/usage/stop", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id }),
      });
    } catch {
      /* ignore */
    }
  }, []);

  const topup = useCallback(
    async (minutes: number): Promise<{ clientSecret?: string; error?: string }> => {
      try {
        const d = await (
          await fetch("/api/usage/topup", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ minutes }),
          })
        ).json();
        if (d.error) return { error: d.error };
        return { clientSecret: d.clientSecret };
      } catch {
        return { error: "network error" };
      }
    },
    []
  );

  useEffect(() => {
    refresh();
    refreshConsent();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh, refreshConsent]);

  return { usage, sessionId, consent, refresh, refreshConsent, acceptConsent, start, stop, topup };
}
