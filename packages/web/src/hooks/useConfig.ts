import { useEffect, useState } from "react";
import type { CallConfig } from "./useLucyCall";

export function useConfig() {
  const [config, setConfig] = useState<CallConfig | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const base =
      import.meta.env.VITE_PUBLIC_SERVER_URL ||
      (window.location.origin.startsWith("http://localhost:5173")
        ? "http://localhost:8787"
        : window.location.origin);
    fetch(`${base}/api/config`)
      .then((r) => r.json())
      .then((d) =>
        setConfig({
          falEndpoint: d.falEndpoint,
          publicServerUrl: base,
          stripeEnabled: Boolean(d.stripeEnabled),
        })
      )
      .catch((e) => setError(String(e)));
  }, []);

  return { config, error };
}
