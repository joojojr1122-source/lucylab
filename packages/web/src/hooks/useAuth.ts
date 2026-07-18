import { useCallback, useEffect, useState } from "react";

export interface AuthUser {
  id: string;
  email: string;
  verified: boolean;
  emailVerified: boolean;
  verificationStatus: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/auth/me", { credentials: "include" });
      if (r.ok) setUser(await r.json());
      else setUser(null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const register = useCallback(async (email: string, password: string) => {
    const r = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) throw new Error((await r.json()).error || "register failed");
    setUser(await r.json());
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error || "login failed");
    }
    setUser(await r.json());
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  }, []);

  const loginWithGoogle = useCallback(() => {
    window.location.href = "/api/auth/google";
  }, []);

  const startVerification = useCallback(async () => {
    const r = await fetch("/api/identity/start", { method: "POST", credentials: "include" });
    if (!r.ok) throw new Error((await r.json()).error || "verification failed");
    return (await r.json()).url as string;
  }, []);

  const refresh = useCallback(() => load(), [load]);

  return { user, loading, register, login, logout, loginWithGoogle, startVerification, refresh };
}
