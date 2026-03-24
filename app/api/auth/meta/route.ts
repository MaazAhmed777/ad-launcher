import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { metaGet } from "@/lib/meta";

const APP_ID = process.env.META_APP_ID!;
const APP_SECRET = process.env.META_APP_SECRET!;
const REDIRECT_URI = process.env.NEXT_PUBLIC_URL + "/api/auth/meta/callback";

// GET /api/auth/meta — redirect to Meta OAuth
export async function GET() {
  const scope = [
    "ads_management", "ads_read", "pages_show_list",
    "pages_read_engagement",
  ].join(",");

  const url = new URL("https://www.facebook.com/dialog/oauth");
  url.searchParams.set("client_id", APP_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", scope);
  url.searchParams.set("response_type", "code");

  return NextResponse.redirect(url.toString());
}
