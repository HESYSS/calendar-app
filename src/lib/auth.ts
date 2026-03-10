import { cookies } from "next/headers";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_DAYS = 30;

export type AuthedUser = { id: string; email: string };
export class UnauthorizedError extends Error {
  status = 401 as const;
  constructor() {
    super("Unauthorized");
  }
}

type UserDoc = {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  createdAt: Date;
};

type SessionDoc = {
  _id: ObjectId;
  userId: ObjectId;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
};

let indexesEnsured = false;
async function ensureAuthIndexes() {
  if (indexesEnsured) return;
  const db = await getDb();
  await db.collection<UserDoc>("users").createIndex({ email: 1 }, { unique: true });
  await db.collection<SessionDoc>("sessions").createIndex({ tokenHash: 1 }, { unique: true });
  await db.collection<SessionDoc>("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection<SessionDoc>("sessions").createIndex({ userId: 1 });
  indexesEnsured = true;
}

function sha256Base64Url(input: string) {
  const buf = createHash("sha256").update(input).digest();
  return buf.toString("base64url");
}

export async function issueSessionCookie(token: string) {
  // Ensure cookie is written as part of this response.
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function createSessionForUser(userId: ObjectId) {
  await ensureAuthIndexes();
  const db = await getDb();
  const sessions = db.collection<SessionDoc>("sessions");

  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256Base64Url(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await sessions.insertOne({
    _id: new ObjectId(),
    userId,
    tokenHash,
    createdAt: now,
    expiresAt,
  });

  await issueSessionCookie(token);
  return { token };
}

export async function revokeSession(token: string) {
  await ensureAuthIndexes();
  const db = await getDb();
  const sessions = db.collection<SessionDoc>("sessions");
  const tokenHash = sha256Base64Url(token);
  await sessions.deleteOne({ tokenHash });
}

export async function getAuthedUser(): Promise<AuthedUser | null> {
  await ensureAuthIndexes();
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value || "";
  if (!token) return null;

  const tokenHash = sha256Base64Url(token);
  const db = await getDb();
  const sessions = db.collection<SessionDoc>("sessions");
  const users = db.collection<UserDoc>("users");

  const session = await sessions.findOne({ tokenHash, expiresAt: { $gt: new Date() } });
  if (!session) return null;

  const user = await users.findOne({ _id: session.userId });
  if (!user) return null;

  // Defensive check: avoid weird unicode normalization issues.
  const emailA = Buffer.from(user.email, "utf8");
  const emailB = Buffer.from(user.email, "utf8");
  if (emailA.length !== emailB.length || !timingSafeEqual(emailA, emailB)) return null;

  return { id: user._id.toString(), email: user.email };
}

export async function requireAuthedUser(): Promise<AuthedUser> {
  const user = await getAuthedUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}
