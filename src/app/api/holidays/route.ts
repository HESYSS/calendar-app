import { NextResponse } from "next/server";
import { z } from "zod";

type Holiday = {
  date: string;
  localName: string;
  name: string;
};

export const runtime = "nodejs";

const QuerySchema = z.object({
  year: z.string().regex(/^\d{4}$/),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
});

const cache = new Map<string, { at: number; value: Holiday[] }>();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    year: url.searchParams.get("year") || "",
    countryCode: (url.searchParams.get("countryCode") || "").toUpperCase(),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Query params 'year' (YYYY) and 'countryCode' (AA) are required" },
      { status: 400 },
    );
  }

  const key = `${parsed.data.year}:${parsed.data.countryCode}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < 12 * 60 * 60 * 1000) {
    return NextResponse.json({ holidays: hit.value });
  }

  const res = await fetch(
    `https://date.nager.at/api/v3/PublicHolidays/${parsed.data.year}/${parsed.data.countryCode}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    return NextResponse.json({ error: "Failed to load holidays" }, { status: 502 });
  }

  const data = (await res.json()) as Holiday[];
  cache.set(key, { at: now, value: data });
  return NextResponse.json({ holidays: data });
}
