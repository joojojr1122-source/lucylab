/// <reference types="vite/client" />

interface LucyVirtualCamera {
  start: () => Promise<{ ok: boolean; active?: boolean; error?: string }>;
  stop: () => Promise<{ ok: boolean; active?: boolean; error?: string }>;
  status: () => Promise<{ connected: boolean; active: boolean }>;
  connect: (url?: string, password?: string) => Promise<{ ok: boolean; error?: string }>;
}

interface Window {
  lucy?: { virtualCamera: LucyVirtualCamera };
}
