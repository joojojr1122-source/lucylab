import { Redis } from "ioredis";

function env(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

const RATE_PER_SECOND = Number(env("CREDIT_RATE_PER_SECOND", "0.05")); // $/sec
const FREE_CREDITS = Number(env("FREE_CREDITS", "10")); // minutes, demo balance

/**
 * Credit store. Uses Redis when REDIS_URL is set, otherwise an in-memory Map.
 * Balances are stored in seconds.
 */
class MemoryStore {
  constructor() {
    this.balances = new Map();
    this.consent = new Set();
  }
  async get(identity) {
    if (!this.balances.has(identity)) this.balances.set(identity, FREE_CREDITS * 60);
    return this.balances.get(identity);
  }
  async set(identity, seconds) {
    this.balances.set(identity, seconds);
  }
  async add(identity, seconds) {
    const next = (this.balances.get(identity) ?? FREE_CREDITS * 60) + seconds;
    this.balances.set(identity, next);
    return next;
  }
  async getConsent(identity) {
    return this.consent.has(identity);
  }
  async setConsent(identity) {
    this.consent.add(identity);
  }
}

class RedisStore {
  constructor(client) {
    this.r = client;
    this.prefix = "lucy:credits:";
    this.consentPrefix = "lucy:consent:";
  }
  async get(identity) {
    const v = await this.r.get(this.prefix + identity);
    if (v === null) {
      await this.r.set(this.prefix + identity, String(FREE_CREDITS * 60));
      return FREE_CREDITS * 60;
    }
    return Number(v);
  }
  async set(identity, seconds) {
    await this.r.set(this.prefix + identity, String(seconds));
  }
  async add(identity, seconds) {
    const next = await this.r.incrbyfloat(this.prefix + identity, seconds);
    return Number(next);
  }
  async getConsent(identity) {
    return (await this.r.get(this.consentPrefix + identity)) === "1";
  }
  async setConsent(identity) {
    await this.r.set(this.consentPrefix + identity, "1");
  }
}

let store;
export function getStore() {
  if (store) return store;
  const url = env("REDIS_URL", "");
  if (url) {
    try {
      const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
      client.on("error", (e) => console.warn("[lucy-call] redis error:", e.message));
      store = new RedisStore(client);
      console.log("[lucy-call] using Redis credit store");
    } catch (e) {
      console.warn("[lucy-call] redis init failed, using memory:", e.message);
      store = new MemoryStore();
    }
  } else {
    store = new MemoryStore();
  }
  return store;
}

export { RATE_PER_SECOND, FREE_CREDITS };
