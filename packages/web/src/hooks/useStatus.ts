import { useEffect, useState } from "react";

export interface ServerStatus {
  fal: boolean;
  livekit: boolean;
  stripe: boolean;
  redis: boolean;
}

export function useStatus(baseUrl: string) {
  const [status, setStatus] = useState<ServerStatus | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`${baseUrl}/api/status`)
        .then((r) => r.json())
        .then(setStatus)
        .catch(() => setStatus(null));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [baseUrl]);

  return status;
}
