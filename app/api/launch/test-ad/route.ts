import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { uploadImageToMeta, uploadVideoToMeta } from "@/lib/meta";
import { readFile } from "fs/promises";
import path from "path";

const META_API = "https://graph.facebook.com/v19.0";
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

async function metaPostDebug(endpoint: string, token: string, body: Record<string, string>) {
  const url = `${META_API}${endpoint}`;
  const form = new URLSearchParams({ ...body, access_token: token });
  const res = await fetch(url, {
    method: "POST",
    body: form,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  const data = await res.json();
  const { access_token: _t, ...sentPayload } = Object.fromEntries(form.entries());
  return { data, sentPayload };
}

async function metaDelete(id: string, token: string) {
  await fetch(`${META_API}/${id}?access_token=${token}`, { method: "DELETE" });
}

const VALID_CUSTOM_EVENT_TYPES = new Set([
  "AD_IMPRESSION","RATE","TUTORIAL_COMPLETION","CONTACT","CUSTOMIZE_PRODUCT","DONATE",
  "FIND_LOCATION","SCHEDULE","START_TRIAL","SUBMIT_APPLICATION","SUBSCRIBE","ADD_TO_CART",
  "ADD_TO_WISHLIST","INITIATED_CHECKOUT","ADD_PAYMENT_INFO","PURCHASE","LEAD",
  "COMPLETE_REGISTRATION","CONTENT_VIEW","SEARCH","SERVICE_BOOKING_REQUEST",
  "MESSAGING_CONVERSATION_STARTED_7D","LEVEL_ACHIEVED","ACHIEVEMENT_UNLOCKED",
  "SPENT_CREDITS","LISTING_INTERACTION","D2_RETENTION","D7_RETENTION","OTHER",
]);

function buildPromotedObject(optimizationGoal: string, pageId: string, pixelId?: string, conversionEvent?: string, appId?: string): Record<string, string> | null {
  switch (optimizationGoal) {
    case "APP_INSTALLS":
    case "APP_EVENTS":
      return appId ? { application_id: appId } : (pageId ? { page_id: pageId } : null);

    case "OFFSITE_CONVERSIONS":
    case "VALUE": {
      if (!pixelId) return pageId ? { page_id: pageId } : null;
      const obj: Record<string, string> = { pixel_id: pixelId };
      if (conversionEvent && VALID_CUSTOM_EVENT_TYPES.has(conversionEvent)) {
        obj.custom_event_type = conversionEvent;
      } else if (conversionEvent && /^\d+$/.test(conversionEvent)) {
        obj.custom_conversion_id = conversionEvent;
      } else {
        obj.custom_event_type = "PURCHASE";
      }
      return obj;
    }

    case "LEAD_GENERATION":
      return pageId ? { page_id: pageId } : null;

    default:
      return pageId ? { page_id: pageId } : null;
  }
}

function resolveAdSetDefaults(objective: string, customOptGoal?: string): { optimization_goal: string; billing_event: string } {
  if (customOptGoal && customOptGoal !== "REACH") {
    const billingEvent = customOptGoal === "LINK_CLICKS" ? "LINK_CLICKS" : "IMPRESSIONS";
    return { optimization_goal: customOptGoal, billing_event: billingEvent };
  }
  switch (objective) {
    case "OUTCOME_TRAFFIC":      return { optimization_goal: "LINK_CLICKS",          billing_event: "LINK_CLICKS" };
    case "OUTCOME_APP_PROMOTION":return { optimization_goal: "APP_INSTALLS",          billing_event: "IMPRESSIONS" };
    case "OUTCOME_LEADS":        return { optimization_goal: "LEAD_GENERATION",       billing_event: "IMPRESSIONS" };
    case "OUTCOME_SALES":        return { optimization_goal: "OFFSITE_CONVERSIONS",   billing_event: "IMPRESSIONS" };
    case "OUTCOME_ENGAGEMENT":   return { optimization_goal: "POST_ENGAGEMENT",       billing_event: "IMPRESSIONS" };
    case "OUTCOME_AWARENESS":
    default:                     return { optimization_goal: "IMPRESSIONS",           billing_event: "IMPRESSIONS" };
  }
}

async function waitForVideo(videoId: string, token: string, maxMs = 30000): Promise<{ ready: boolean; thumbnailUrl?: string; statusData: any }> {
  const interval = 3000;
  const attempts = Math.ceil(maxMs / interval);
  let statusData: any = null;
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, interval));
    const res = await fetch(`${META_API}/${videoId}?fields=status,picture&access_token=${token}`);
    statusData = await res.json();
    const vs = statusData?.status?.video_status;
    if (vs === "ready") return { ready: true, thumbnailUrl: statusData.picture, statusData };
    if (vs === "error") return { ready: false, statusData };
  }
  return { ready: false, statusData };
}

function isAppStoreUrl(url: string) {
  return /apps\.apple\.com|play\.google\.com|itunes\.apple\.com/i.test(url);
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  const body = await req.json();
  const { accountId, pageId, instagramAccountId, rows, newCampaign, pixelId, conversionEvent } = body;
  let { adSetId } = body;

  if (!user?.metaToken) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const token = user.metaToken;
  const actId = accountId || user.adAccounts?.[0]?.accountId;
  const row = rows?.[0];
  if (!row) return NextResponse.json({ error: "No rows provided" });

  const primary = row.creatives[0];
  if (!primary) return NextResponse.json({ error: "No creatives in row" });

  const steps: any[] = [];
  const link = row.destinationUrl || "https://example.com";
  let cta = row.cta || "LEARN_MORE";
  if (cta === "DOWNLOAD" && !isAppStoreUrl(link)) cta = "LEARN_MORE";

  // Track temp resources to clean up
  let tempCampaignId: string | null = null;
  let tempAdSetId: string | null = null;

  // Create temp campaign + ad set if no existing adSetId
  if (!adSetId) {
    if (!newCampaign) return NextResponse.json({ error: "Provide either adSetId or newCampaign params" });
    const now = new Date().toISOString().slice(0, 10);

    const needsBid = ["COST_CAP", "LOWEST_COST_WITH_BID_CAP", "MINIMUM_ROAS"].includes(newCampaign.bidStrategy);
    const bidStrategy = (needsBid && !newCampaign.bidAmount) ? "LOWEST_COST_WITHOUT_CAP" : (newCampaign.bidStrategy || "LOWEST_COST_WITHOUT_CAP");
    const useCBO = !!newCampaign.campaignLevelBudget;
    const campBody: Record<string, string> = {
      name: `[DEBUG TEST] Campaign ${now}`,
      objective: newCampaign.objective || "OUTCOME_TRAFFIC",
      status: "PAUSED",
      special_ad_categories: "[]",
    };
    if (useCBO) {
      campBody.daily_budget = String(Math.round(parseFloat(newCampaign.campaignLevelBudget) * 100));
      campBody.bid_strategy = bidStrategy;
    } else {
      campBody.is_adset_budget_sharing_enabled = "false";
    }
    const { data: camp, sentPayload: campPayload } = await metaPostDebug(`/act_${actId}/campaigns`, token, campBody);
    steps.push({ step: "create_temp_campaign", sentPayload: campPayload, response: camp });
    if (!camp.id) return NextResponse.json({ ok: false, stoppedAt: "create_temp_campaign", metaError: camp.error, steps });
    tempCampaignId = camp.id;

    const { optimization_goal: optimizationGoal, billing_event: billingEvent } =
      bidStrategy === "MINIMUM_ROAS"
        ? { optimization_goal: "VALUE", billing_event: "IMPRESSIONS" }
        : resolveAdSetDefaults(newCampaign.objective || "OUTCOME_AWARENESS", newCampaign.optimizationGoal);

    const adSetBody: Record<string, string> = {
      name: `[DEBUG TEST] Ad Set ${now}`,
      campaign_id: camp.id,
      billing_event: billingEvent,
      optimization_goal: optimizationGoal,
      bid_strategy: bidStrategy,
      targeting: JSON.stringify({ geo_locations: { countries: ["US"] }, age_min: 18, age_max: 65 }),
      status: "PAUSED",
    };
    if (!useCBO) {
      adSetBody.daily_budget = String(Math.round(parseFloat(newCampaign.budget || "1") * 100));
    }
    const promotedObject = buildPromotedObject(optimizationGoal, pageId, pixelId, conversionEvent);
    if (promotedObject) adSetBody.promoted_object = JSON.stringify(promotedObject);
    if (newCampaign.bidAmount && (bidStrategy === "COST_CAP" || bidStrategy === "LOWEST_COST_WITH_BID_CAP")) {
      adSetBody.bid_amount = String(Math.round(parseFloat(newCampaign.bidAmount) * 100));
    }
    if (newCampaign.bidAmount && bidStrategy === "MINIMUM_ROAS") {
      adSetBody.bid_constraints = JSON.stringify({ roas_average_floor: Math.round(parseFloat(newCampaign.bidAmount) * 10000) });
    }
    const { data: adSet, sentPayload: adSetPayload } = await metaPostDebug(`/act_${actId}/adsets`, token, adSetBody);
    steps.push({ step: "create_temp_adset", sentPayload: adSetPayload, response: adSet });
    if (!adSet.id) {
      if (tempCampaignId) await metaDelete(tempCampaignId, token).catch(() => {});
      return NextResponse.json({ ok: false, stoppedAt: "create_temp_adset", metaError: adSet.error, steps });
    }
    tempAdSetId = adSet.id;
    adSetId = adSet.id;
  }

  steps.push({ step: "config", actId, pageId, adSetId, instagramAccountId, cta, link });

  // Step 1: check the ad set
  try {
    const asRes = await fetch(`${META_API}/${adSetId}?fields=id,name,status,is_dynamic_creative,campaign_id&access_token=${token}`);
    const asData = await asRes.json();
    steps.push({ step: "adset_info", data: asData });
    if (asData.error) {
      return NextResponse.json({ ok: false, stoppedAt: "adset_info", metaError: asData.error, steps });
    }
    if (asData.is_dynamic_creative) {
      steps.push({ step: "adset_warning", message: "Ad set has is_dynamic_creative=true — regular object_story_spec creatives cannot be used with dynamic creative ad sets" });
    }
  } catch (err: any) {
    steps.push({ step: "adset_info", error: err.message });
  }

  let creativeId: string | null = null;

  try {
    // Step 2: upload creative
    const filepath = path.join(UPLOAD_DIR, path.basename(primary.filename));
    const buffer = (await readFile(filepath)).buffer as ArrayBuffer;
    steps.push({ step: "read_file", ok: true, bytes: buffer.byteLength });

    let asset: { videoId?: string; imageHash?: string; thumbnailUrl?: string } = {};
    if (primary.isVideo) {
      const { videoId } = await uploadVideoToMeta(actId, token, buffer, primary.originalName);
      asset.videoId = videoId;
      steps.push({ step: "upload_video", ok: true, videoId });

      const { ready, thumbnailUrl, statusData } = await waitForVideo(videoId, token, 30000);
      steps.push({ step: "video_status", ready, thumbnailUrl, status: statusData });
      if (!ready) return NextResponse.json({ ok: false, stoppedAt: "video_status", error: "Video not ready", steps });
      asset.thumbnailUrl = thumbnailUrl;
    } else {
      const { hash } = await uploadImageToMeta(actId, token, buffer, primary.originalName);
      asset.imageHash = hash;
      steps.push({ step: "upload_image", ok: true, hash });
    }

    // Step 3: build & create creative
    let storySpec: Record<string, any>;
    if (primary.isVideo) {
      storySpec = {
        page_id: pageId,
        video_data: {
          video_id: asset.videoId,
          image_url: asset.thumbnailUrl,
          call_to_action: { type: cta, value: { link } },
        },
      };
    } else {
      storySpec = {
        page_id: pageId,
        link_data: {
          image_hash: asset.imageHash,
          link,
          call_to_action: { type: cta, value: { link } },
        },
      };
    }
    if (instagramAccountId) storySpec.instagram_actor_id = instagramAccountId;

    const crBody = { name: `[DEBUG] ${row.name}`, object_story_spec: JSON.stringify(storySpec) };
    steps.push({ step: "build_creative", storySpec });

    const { data: cr, sentPayload: crPayload } = await metaPostDebug(`/act_${actId}/adcreatives`, token, crBody);
    steps.push({ step: "create_creative", sentPayload: crPayload, response: cr });

    if (!cr.id) {
      return NextResponse.json({ ok: false, stoppedAt: "create_creative", metaError: cr.error, steps });
    }
    creativeId = cr.id;

    // Step 4: create ad (paused)
    const adBody = {
      name: `[DEBUG] ${row.name}`,
      adset_id: adSetId,
      creative: JSON.stringify({ creative_id: cr.id }),
      status: "PAUSED",
    };

    const { data: ar, sentPayload: adPayload } = await metaPostDebug(`/act_${actId}/ads`, token, adBody);
    steps.push({ step: "create_ad", sentPayload: adPayload, response: ar });

    if (!ar.id) {
      return NextResponse.json({ ok: false, stoppedAt: "create_ad", metaError: ar.error, steps });
    }

    // Step 5: clean up — delete test ad, creative, and any temp campaign/ad set
    await metaDelete(ar.id, token);
    steps.push({ step: "cleanup_ad", deleted: ar.id });
    await metaDelete(cr.id, token);
    steps.push({ step: "cleanup_creative", deleted: cr.id });
    if (tempAdSetId) { await metaDelete(tempAdSetId, token).catch(() => {}); steps.push({ step: "cleanup_temp_adset", deleted: tempAdSetId }); }
    if (tempCampaignId) { await metaDelete(tempCampaignId, token).catch(() => {}); steps.push({ step: "cleanup_temp_campaign", deleted: tempCampaignId }); }

    return NextResponse.json({ ok: true, steps });
  } catch (err: any) {
    // Best-effort cleanup
    if (creativeId) await metaDelete(creativeId, token).catch(() => {});
    if (tempAdSetId) await metaDelete(tempAdSetId, token).catch(() => {});
    if (tempCampaignId) await metaDelete(tempCampaignId, token).catch(() => {});
    steps.push({ step: "exception", error: err.message });
    return NextResponse.json({ ok: false, error: err.message, steps });
  }
}
