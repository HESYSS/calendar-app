import { NextResponse } from "next/server";

type Country = { countryCode: string; name: string };

export const runtime = "nodejs";

let cache: { at: number; value: Country[] } | null = null;

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.at < 12 * 60 * 60 * 1000) {
    return NextResponse.json({ countries: cache.value });
  }

  const res = await fetch("https://date.nager.at/api/v3/AvailableCountries", {
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ error: "Failed to load countries" }, { status: 502 });
  }

  const data = (await res.json()) as Country[];
  cache = { at: now, value: data };
  return NextResponse.json({ countries: data });
}
