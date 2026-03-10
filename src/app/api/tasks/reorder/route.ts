import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAuthedUser, UnauthorizedError } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { TaskReorderSchema } from "../schema";

export const runtime = "nodejs";

type TaskDoc = {
  _id: ObjectId;
  userId: ObjectId;
  date: string;
  title: string;
  description?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

export async function POST(req: Request) {
  let userId: ObjectId;
  try {
    const user = await requireAuthedUser();
    userId = new ObjectId(user.id);
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw e;
  }

  const body = await req.json().catch(() => null);
  const parsed = TaskReorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updates = parsed.data.updates.filter((u) => ObjectId.isValid(u.id));
  if (updates.length === 0) {
    return NextResponse.json({ error: "No valid ids" }, { status: 400 });
  }

  const db = await getDb();
  const tasks = db.collection<TaskDoc>("tasks");
  const now = new Date();

  await tasks.bulkWrite(
    updates.map((u) => ({
      updateOne: {
        filter: { _id: new ObjectId(u.id), userId },
        update: { $set: { date: u.date, order: u.order, updatedAt: now } },
      },
    })),
    { ordered: false },
  );

  return NextResponse.json({ ok: true });
}
