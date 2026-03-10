import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { requireAuthedUser, UnauthorizedError } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { TaskCreateSchema } from "./schema";

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

let indexesEnsured = false;
async function ensureIndexes() {
  if (indexesEnsured) return;
  const db = await getDb();
  await db.collection<TaskDoc>("tasks").createIndex({ userId: 1, date: 1, order: 1 });
  indexesEnsured = true;
}

export async function GET(req: Request) {
  await ensureIndexes();
  let userId: ObjectId;
  try {
    const user = await requireAuthedUser();
    userId = new ObjectId(user.id);
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw e;
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const q = (url.searchParams.get("q") || "").trim();

  const DateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  const parsed = z.object({ from: DateKey, to: DateKey }).safeParse({ from, to });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Query params 'from' and 'to' (YYYY-MM-DD) are required" },
      { status: 400 },
    );
  }

  const db = await getDb();
  const tasks = db.collection<TaskDoc>("tasks");

  const filter: Record<string, unknown> = { userId, date: { $gte: from, $lte: to } };
  if (q) {
    filter.$or = [
      { title: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
    ];
  }

  const docs = await tasks
    .find(filter)
    .sort({ date: 1, order: 1, createdAt: 1 })
    .limit(5000)
    .toArray();

  return NextResponse.json({
    tasks: docs.map((d) => ({
      id: d._id.toString(),
      date: d.date,
      title: d.title,
      description: d.description,
      order: d.order,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  await ensureIndexes();
  let userId: ObjectId;
  try {
    const user = await requireAuthedUser();
    userId = new ObjectId(user.id);
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw e;
  }

  const body = await req.json().catch(() => null);
  const parsed = TaskCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const db = await getDb();
  const tasks = db.collection<TaskDoc>("tasks");

  let order = parsed.data.order;
  if (order == null) {
    const last = await tasks
      .find({ userId, date: parsed.data.date })
      .sort({ order: -1 })
      .limit(1)
      .toArray();
    order = last[0]?.order != null ? last[0].order + 1 : 0;
  }

  const now = new Date();
  const doc: Omit<TaskDoc, "_id"> = {
    userId,
    date: parsed.data.date,
    title: parsed.data.title,
    description: parsed.data.description,
    order,
    createdAt: now,
    updatedAt: now,
  };

  const result = await tasks.insertOne(doc as TaskDoc);
  return NextResponse.json(
    {
      task: {
        id: result.insertedId.toString(),
        ...doc,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
