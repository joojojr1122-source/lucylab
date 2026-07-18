import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

function env(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/**
 * User store. Postgres when DATABASE_URL is set (commercial-grade, durable),
 * otherwise an in-memory fallback for local dev.
 *
 * Two verification concepts:
 *  - email_verified: confirmed via email link (password users) or Google (auto)
 *  - verified (identity): confirmed via Stripe Identity (required to broadcast/call)
 */
class MemoryStore {
  constructor() {
    this.users = new Map();
    this.byEmail = new Map();
    this.byGoogle = new Map();
    this.sessions = new Map();
  }

  async init() {}

  async createUser(email, passwordHash) {
    const id = randomUUID();
    const user = {
      id,
      email,
      passwordHash,
      googleSub: null,
      emailVerified: false,
      emailToken: randomUUID(),
      verified: false,
      verificationStatus: "unverified",
      createdAt: new Date().toISOString(),
    };
    this.users.set(id, user);
    this.byEmail.set(email.toLowerCase(), id);
    return user;
  }

  async createGoogleUser(email, googleSub, name) {
    const id = randomUUID();
    const user = {
      id,
      email,
      passwordHash: null,
      googleSub,
      name: name || null,
      emailVerified: true,
      emailToken: null,
      verified: false,
      verificationStatus: "unverified",
      createdAt: new Date().toISOString(),
    };
    this.users.set(id, user);
    this.byEmail.set(email.toLowerCase(), id);
    this.byGoogle.set(googleSub, id);
    return user;
  }

  async findByEmail(email) {
    const id = this.byEmail.get(email.toLowerCase());
    return id ? this.users.get(id) : null;
  }

  async findByGoogleSub(sub) {
    const id = this.byGoogle.get(sub);
    return id ? this.users.get(id) : null;
  }

  async findById(id) {
    return this.users.get(id) || null;
  }

  async findByEmailToken(token) {
    for (const u of this.users.values()) if (u.emailToken === token) return u;
    return null;
  }

  async setEmailVerified(id) {
    const u = this.users.get(id);
    if (u) {
      u.emailVerified = true;
      u.emailToken = null;
    }
  }

  async setVerification(id, status) {
    const u = this.users.get(id);
    if (u) {
      u.verificationStatus = status;
      u.verified = status === "verified";
    }
  }

  async createSession(userId) {
    const token = randomUUID();
    this.sessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
    return token;
  }

  async getSession(token) {
    const s = this.sessions.get(token);
    if (!s) return null;
    if (s.expiresAt < Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    return s;
  }

  async deleteSession(token) {
    this.sessions.delete(token);
  }
}

class PgStore {
  constructor(pool) {
    this.db = pool;
  }

  async init() {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        google_sub TEXT,
        name TEXT,
        email_verified BOOLEAN NOT NULL DEFAULT false,
        email_token TEXT,
        verified BOOLEAN NOT NULL DEFAULT false,
        verification_status TEXT NOT NULL DEFAULT 'unverified',
        verification_ref TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at BIGINT NOT NULL
      );
    `);
  }

  async createUser(email, passwordHash) {
    const id = randomUUID();
    const emailToken = randomUUID();
    const { rows } = await this.db.query(
      `INSERT INTO users (id, email, password_hash, email_token) VALUES ($1,$2,$3,$4) RETURNING *`,
      [id, email.toLowerCase(), passwordHash, emailToken]
    );
    return rows[0];
  }

  async createGoogleUser(email, googleSub, name) {
    const id = randomUUID();
    const { rows } = await this.db.query(
      `INSERT INTO users (id, email, google_sub, name, email_verified) VALUES ($1,$2,$3,$4,true) RETURNING *`,
      [id, email.toLowerCase(), googleSub, name || null]
    );
    return rows[0];
  }

  async findByEmail(email) {
    const { rows } = await this.db.query(`SELECT * FROM users WHERE email=$1`, [email.toLowerCase()]);
    return rows[0] || null;
  }

  async findByGoogleSub(sub) {
    const { rows } = await this.db.query(`SELECT * FROM users WHERE google_sub=$1`, [sub]);
    return rows[0] || null;
  }

  async findById(id) {
    const { rows } = await this.db.query(`SELECT * FROM users WHERE id=$1`, [id]);
    return rows[0] || null;
  }

  async findByEmailToken(token) {
    const { rows } = await this.db.query(`SELECT * FROM users WHERE email_token=$1`, [token]);
    return rows[0] || null;
  }

  async setEmailVerified(id) {
    await this.db.query(`UPDATE users SET email_verified=true, email_token=NULL WHERE id=$1`, [id]);
  }

  async setVerification(id, status, ref) {
    await this.db.query(
      `UPDATE users SET verification_status=$2, verified=$3, verification_ref=$4 WHERE id=$1`,
      [id, status, status === "verified", ref || null]
    );
  }

  async createSession(userId) {
    const token = randomUUID();
    await this.db.query(`INSERT INTO sessions (token, user_id, expires_at) VALUES ($1,$2,$3)`, [
      token,
      userId,
      Date.now() + SESSION_TTL_MS,
    ]);
    return token;
  }

  async getSession(token) {
    const { rows } = await this.db.query(`SELECT * FROM sessions WHERE token=$1`, [token]);
    const s = rows[0];
    if (!s) return null;
    if (s.expires_at < Date.now()) {
      await this.db.query(`DELETE FROM sessions WHERE token=$1`, [token]);
      return null;
    }
    return s;
  }

  async deleteSession(token) {
    await this.db.query(`DELETE FROM sessions WHERE token=$1`, [token]);
  }
}

let store;
export async function getStore() {
  if (store) return store;
  const url = env("DATABASE_URL", "");
  if (url) {
    const pool = new Pool({ connectionString: url });
    store = new PgStore(pool);
    await store.init();
    console.log("[lucy-call] using Postgres user store");
  } else {
    store = new MemoryStore();
    console.log("[lucy-call] using in-memory user store (set DATABASE_URL for durability)");
  }
  return store;
}

export { bcrypt, randomUUID, SESSION_TTL_MS };
