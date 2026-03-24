import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { metaGet } from "@/lib/meta";

// Standard Meta pixel events
const STANDARD_EVENTS = [
  "Purchase", "AddToCart", "InitiateCheckout", "AddPaymentInfo",
  "Lead", "CompleteRegistration", "Subscribe", "StartTrial",
  "ViewContent", "Search", "AddToWishlist", "Contact",
  "CustomizeProduct", "Donate", "FindLocation", "Schedule",
  "SubmitApplication",
];

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user?.metaToken) {
    return NextResponse.json({ pages: [], igAccounts: [], pixels: [], conversions: [], apps: [] });
  }

  const accountId = req.nextUrl.searchParams.get("accountId")
    || user.adAccounts?.[0]?.accountId;
  const pageId = req.nextUrl.searchParams.get("pageId");

  if (!accountId) {
    return NextResponse.json({ pages: [], igAccounts: [], pixels: [], conversions: [], apps: [] });
  }

  // Fetch all in parallel
  const [pagesRes, igRes, pixelsRes, conversionsRes, appsRes] = await Promise.allSettled([
    // Facebook pages the ad account can promote
    metaGet(`/act_${accountId}/promote_pages`, user.metaToken, {
      fields: "id,name,picture",
      limit: "50",
    }),
    // Instagram accounts linked to the ad account (or to a specific page)
    pageId
      ? metaGet(`/${pageId}/instagram_accounts`, user.metaToken, {
          fields: "id,username,profile_pic",
          limit: "50",
        })
      : metaGet(`/act_${accountId}/instagram_accounts`, user.metaToken, {
          fields: "id,username",
          limit: "50",
        }),
    // Pixels
    metaGet(`/act_${accountId}/adspixels`, user.metaToken, {
      fields: "id,name,creation_time",
      limit: "50",
    }),
    // Custom conversions
    metaGet(`/act_${accountId}/customconversions`, user.metaToken, {
      fields: "id,name,event_source_type,custom_event_type",
      limit: "100",
    }),
    // Apps linked to account
    metaGet(`/act_${accountId}/applications`, user.metaToken, {
      fields: "id,name,object_store_urls",
      limit: "50",
    }),
  ]);

  const pages = pagesRes.status === "fulfilled" ? (pagesRes.value.data || []) : [];
  const igAccounts = igRes.status === "fulfilled" ? (igRes.value.data || []) : [];
  const pixels = pixelsRes.status === "fulfilled" ? (pixelsRes.value.data || []) : [];
  const customConversions = conversionsRes.status === "fulfilled" ? (conversionsRes.value.data || []) : [];
  const apps = appsRes.status === "fulfilled" ? (appsRes.value.data || []) : [];

  // Merge standard events + custom conversions into one list
  const conversions = [
    ...STANDARD_EVENTS.map((e) => ({ id: e, name: e.replace(/([A-Z])/g, " $1").trim(), type: "standard" })),
    ...customConversions.map((c: any) => ({ id: c.id, name: c.name, type: "custom" })),
  ];

  return NextResponse.json({ pages, igAccounts, pixels, conversions, apps });
}
