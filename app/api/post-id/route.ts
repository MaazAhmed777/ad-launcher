import { NextResponse } from "next/server";

// Requires Meta connection
export async function GET() {
  return NextResponse.json({ error: "Connect Meta account to fetch posts" }, { status: 400 });
}

export async function POST() {
  return NextResponse.json({ error: "Connect Meta account to browse ads" }, { status: 400 });
}
