import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { metaGet, metaPost } from "@/lib/meta";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user?.metaToken) return NextResponse.json({ data: [] });

  const accountId = req.nextUrl.searchParams.get("accountId")
    || user.adAccounts?.[0]?.accountId;
  if (!accountId) return NextResponse.json({ data: [] });

  const data = await metaGet(`/act_${accountId}/campaigns`, user.metaToken, {
    fields: "id,name,objective,status,daily_budget,lifetime_budget,created_time",
    limit: "100",
  });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user?.metaToken) return NextResponse.json({ error: "Connect Meta account first" }, { status: 400 });

  const body = await req.json();
  const { action, accountId } = body;
  const actId = accountId || user.adAccounts?.[0]?.accountId;

  if (action === "create") {
    const { name, objective, dailyBudget } = body;
    const result = await metaPost(`/act_${actId}/campaigns`, user.metaToken, {
      name,
      objective,
      status: "PAUSED",
      special_ad_categories: "[]",
      ...(dailyBudget ? { daily_budget: String(dailyBudget) } : {}),
    });
    return NextResponse.json(result);
  }

  if (action === "duplicate_adset") {
    const { adSetId, campaignId, newName } = body;
    const orig = await metaGet(`/${adSetId}`, user.metaToken, {
      fields: "name,campaign_id,daily_budget,lifetime_budget,billing_event,optimization_goal,targeting,status",
    });
    const adsetData: Record<string, string> = {
      name: newName || `${orig.name} (copy)`,
      campaign_id: campaignId || orig.campaign_id,
      billing_event: orig.billing_event || "IMPRESSIONS",
      optimization_goal: orig.optimization_goal || "IMPRESSIONS",
      status: "PAUSED",
    };
    if (orig.daily_budget) adsetData.daily_budget = orig.daily_budget;
    if (orig.lifetime_budget) adsetData.lifetime_budget = orig.lifetime_budget;
    if (orig.targeting) adsetData.targeting = JSON.stringify(orig.targeting);
    const result = await metaPost(`/act_${actId}/adsets`, user.metaToken, adsetData);
    return NextResponse.json(result);
  }

  if (action === "duplicate_campaign") {
    const { campaignId, newName } = body;
    const orig = await metaGet(`/${campaignId}`, user.metaToken, {
      fields: "name,objective,status,daily_budget,lifetime_budget",
    });
    const campData: Record<string, string> = {
      name: newName || `${orig.name} (copy)`,
      objective: orig.objective,
      status: "PAUSED",
      special_ad_categories: "[]",
    };
    if (orig.daily_budget) campData.daily_budget = orig.daily_budget;
    const result = await metaPost(`/act_${actId}/campaigns`, user.metaToken, campData);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
