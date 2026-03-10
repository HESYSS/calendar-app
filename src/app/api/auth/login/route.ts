import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";

import { createSessionForUser } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { LoginSchema } from "../schema";

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
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  const user = await users.findOne({ email: parsed.data.email });
  if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  await createSessionForUser(user._id);
  return NextResponse.json({ user: { id: user._id.toString(), email: user.email } });
}
