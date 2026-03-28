import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  cookieStore.delete("ml_user_id");
  cookieStore.delete("app_session");
  return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_URL!));
}

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("ml_user_id");
  cookieStore.delete("app_session");
  return NextResponse.json({ ok: true });
}
