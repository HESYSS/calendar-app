import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";

import { createSessionForUser } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { RegisterSchema } from "../schema";

export const runtime = "nodejs";

type UserDoc = {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  createdAt: Date;
};

let indexesEnsured = false;
async function ensureIndexes() {
  if (indexesEnsured) return;
  const db = await getDb();
  await db.collection<UserDoc>("users").createIndex({ email: 1 }, { unique: true });
  indexesEnsured = true;
}

export async function POST(req: Request) {
  await ensureIndexes();

  const body = await req.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const db = await getDb();
  const users = db.collection<UserDoc>("users");

  const existing = await users.findOne({ email: parsed.data.email });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const now = new Date();
  const user: UserDoc = {
    _id: new ObjectId(),
    email: parsed.data.email,
    passwordHash,
    createdAt: now,
  };

  await users.insertOne(user);
  await createSessionForUser(user._id);

  return NextResponse.json({ user: { id: user._id.toString(), email: user.email } }, { status: 201 });
}
