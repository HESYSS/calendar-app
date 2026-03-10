import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAuthedUser, UnauthorizedError } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { TaskPatchSchema } from "../schema";

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let userId: ObjectId;
  try {
    const user = await requireAuthedUser();
    userId = new ObjectId(user.id);
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw e;
  }

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = TaskPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const db = await getDb();
  const tasks = db.collection<TaskDoc>("tasks");

  const patch: Partial<TaskDoc> & { updatedAt: Date } = {
    ...parsed.data,
    updatedAt: new Date(),
  };

  if (patch.date && patch.order == null) {
    const last = await tasks
      .find({ userId, date: patch.date })
      .sort({ order: -1 })
      .limit(1)
      .toArray();
    patch.order = last[0]?.order != null ? last[0].order + 1 : 0;
  }

  const doc = await tasks.findOneAndUpdate(
    { _id: new ObjectId(id), userId },
    { $set: patch },
    { returnDocument: "after" },
  );
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    task: {
      id: doc._id.toString(),
      date: doc.date,
      title: doc.title,
      description: doc.description,
      order: doc.order,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let userId: ObjectId;
  try {
    const user = await requireAuthedUser();
    userId = new ObjectId(user.id);
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw e;
  }

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = await getDb();
  const tasks = db.collection<TaskDoc>("tasks");
  const result = await tasks.deleteOne({ _id: new ObjectId(id), userId });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
