import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { metaGet } from "@/lib/meta";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user?.metaToken) return NextResponse.json({ data: [] });

  // Optionally fetch Instagram accounts for a specific page
  const pageId = req.nextUrl.searchParams.get("pageId");
  if (pageId) {
    const data = await metaGet(`/${pageId}`, user.metaToken, {
      fields: "instagram_accounts{id,username,profile_pic}",
    });
    return NextResponse.json({ data: data.instagram_accounts?.data || [] });
  }

  // Fetch Facebook pages
  const data = await metaGet("/me/accounts", user.metaToken, {
    fields: "name,id,access_token,picture",
    limit: "50",
  });
  console.log("Pages API response:", JSON.stringify(data));
  return NextResponse.json(data);
}
