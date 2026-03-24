import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/launch?drive_error=1", req.url));
  // Redirect back to launch with the code — JS will exchange it
  return NextResponse.redirect(new URL(`/launch?drive_code=${code}`, req.url));
}
