import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  cookieStore.delete("ml_user_id");
  return NextResponse.redirect(new URL("/launch", process.env.NEXT_PUBLIC_URL!));
}

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("ml_user_id");
  return NextResponse.json({ ok: true });
}
