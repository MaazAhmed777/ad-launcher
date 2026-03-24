import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { metaGet, metaPost } from "@/lib/meta";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user?.metaToken) return NextResponse.json({ data: [] });

  const accountId = req.nextUrl.searchParams.get("accountId")
    || user.adAccounts?.[0]?.accountId;
  if (!accountId) return NextResponse.json({ data: [] });

  const data = await metaGet(`/act_${accountId}/adsets`, user.metaToken, {
    fields: "name,id,status,daily_budget,lifetime_budget,campaign_id",
    limit: "200",
  });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user?.metaToken) return NextResponse.json({ error: "Connect Meta account first" }, { status: 400 });

  const body = await req.json();
  const { accountId, campaignId, name, dailyBudget, optimizationGoal, countries, ageMin, ageMax } = body;
  const actId = accountId || user.adAccounts?.[0]?.accountId;

  const targeting = JSON.stringify({
    geo_locations: { countries: countries || ["US"] },
    age_min: ageMin || 18,
    age_max: ageMax || 65,
  });

  const result = await metaPost(`/act_${actId}/adsets`, user.metaToken, {
    name,
    campaign_id: campaignId,
    daily_budget: String(dailyBudget),
    billing_event: "IMPRESSIONS",
    optimization_goal: optimizationGoal || "IMPRESSIONS",
    targeting,
    status: "PAUSED",
  });
  return NextResponse.json(result);
}
