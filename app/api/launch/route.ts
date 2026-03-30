import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { metaPost, uploadImageToMeta, uploadVideoToMeta } from "@/lib/meta";
const META_API = "https://graph.facebook.com/v19.0";

async function waitForVideo(videoId: string, token: string, maxMs = 30000): Promise<{ ready: boolean; thumbnailUrl?: string }> {
  const interval = 3000;
  const attempts = Math.ceil(maxMs / interval);
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, interval));
    const res = await fetch(`${META_API}/${videoId}?fields=status,picture&access_token=${token}`);
    const data = await res.json();
    const vs = data?.status?.video_status;
    if (vs === "ready") return { ready: true, thumbnailUrl: data.picture };
    if (vs === "error") return { ready: false };
  }
  return { ready: false };
}

function isAppStoreUrl(url: string) {
  return /apps\.apple\.com|play\.google\.com|itunes\.apple\.com/i.test(url);
}

function resolveCta(cta: string, link: string): string {
  if (cta === "DOWNLOAD" && !isAppStoreUrl(link)) return "LEARN_MORE";
  return cta;
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
        obj.custom_event_type = "PURCHASE"; // safe default for sales
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

// POST /api/launch — launch a batch of ads
export async function POST(req: NextRequest) {
  const user = await getSession();
  const body = await req.json();
  const { accountId, pageId, rows, disableEnhancements, launchAsActive, newCampaign, pixelId, conversionEvent, appId } = body;

  const metaToken = user?.metaToken;
  if (!metaToken) {
    return NextResponse.json({ error: "Connect Meta account before launching" }, { status: 400 });
  }

  const userId = user.id;
  const actId = accountId || user.adAccounts?.[0]?.accountId;

  // For new campaigns: create campaign + ad set first, assign adSetId to all rows
  let effectiveRows = rows;
  if (newCampaign) {
    const now = new Date().toISOString().slice(0, 10);

    // Fall back to lowest cost if a bid-required strategy has no bid amount
    const needsBid = ["COST_CAP", "LOWEST_COST_WITH_BID_CAP", "MINIMUM_ROAS"].includes(newCampaign.bidStrategy);
    const bidStrategy = (needsBid && !newCampaign.bidAmount) ? "LOWEST_COST_WITHOUT_CAP" : (newCampaign.bidStrategy || "LOWEST_COST_WITHOUT_CAP");
    const useCBO = !!newCampaign.campaignLevelBudget;

    const campPayload: Record<string, string> = {
      name: newCampaign.campaignName || `Campaign ${now}`,
      objective: newCampaign.objective,
      status: "PAUSED",
      special_ad_categories: "[]",
    };
    if (useCBO) {
      campPayload.daily_budget = String(Math.round(parseFloat(newCampaign.campaignLevelBudget) * 100));
      campPayload.bid_strategy = bidStrategy;
    } else {
      campPayload.is_adset_budget_sharing_enabled = "false";
    }
    console.log("[launch] Creating campaign:", campPayload);
    const camp = await metaPost(`/act_${actId}/campaigns`, metaToken, campPayload);
    console.log("[launch] Campaign response:", JSON.stringify(camp));
    if (!camp.id) {
      const msg = camp.error?.error_user_msg || camp.error?.message || JSON.stringify(camp.error);
      return NextResponse.json({ error: `Campaign creation failed: ${msg}` }, { status: 400 });
    }

    const { optimization_goal: optimizationGoal, billing_event: billingEvent } =
      bidStrategy === "MINIMUM_ROAS"
        ? { optimization_goal: "VALUE", billing_event: "IMPRESSIONS" }
        : resolveAdSetDefaults(newCampaign.objective, newCampaign.optimizationGoal);

    const adSetPayload: Record<string, string> = {
      name: newCampaign.adSetName || `Ad Set ${now}`,
      campaign_id: camp.id,
      billing_event: billingEvent,
      optimization_goal: optimizationGoal,
      bid_strategy: bidStrategy,
      targeting: JSON.stringify({ geo_locations: { countries: ["US"] }, age_min: 18, age_max: 65 }),
      status: "PAUSED",
    };
    if (!useCBO) {
      adSetPayload.daily_budget = String(Math.round(parseFloat(newCampaign.budget) * 100));
    }
    const promotedObject = buildPromotedObject(optimizationGoal, pageId, pixelId, conversionEvent, appId);
    if (promotedObject) adSetPayload.promoted_object = JSON.stringify(promotedObject);
    if (newCampaign.bidAmount && (bidStrategy === "COST_CAP" || bidStrategy === "LOWEST_COST_WITH_BID_CAP")) {
      adSetPayload.bid_amount = String(Math.round(parseFloat(newCampaign.bidAmount) * 100));
    }
    if (newCampaign.bidAmount && bidStrategy === "MINIMUM_ROAS") {
      adSetPayload.bid_constraints = JSON.stringify({ roas_average_floor: Math.round(parseFloat(newCampaign.bidAmount) * 10000) });
    }
    console.log("[launch] Creating ad set:", adSetPayload);
    const adSet = await metaPost(`/act_${actId}/adsets`, metaToken, adSetPayload);
    console.log("[launch] Ad set response:", JSON.stringify(adSet));
    if (!adSet.id) {
      const msg = adSet.error?.error_user_msg || adSet.error?.message || JSON.stringify(adSet.error);
      return NextResponse.json({ error: `Ad set creation failed: ${msg}` }, { status: 400 });
    }

    effectiveRows = rows.map((r: any) => ({ ...r, adSetId: adSet.id }));
  }

  const batch = await prisma.adBatch.create({
    data: {
      userId,
      accountId: actId,
      totalAds: effectiveRows.length, // one ad per group
      status: "running",
    },
  });

  const instagramAccountId = body.instagramAccountId || "";
  // Launch ads asynchronously
  launchBatch(batch.id, metaToken, actId, pageId, instagramAccountId, effectiveRows, disableEnhancements, launchAsActive).catch(console.error);

  return NextResponse.json({ batchId: batch.id });
}

async function uploadCreative(
  c: any,
  accountId: string,
  token: string
): Promise<{ videoId?: string; imageHash?: string }> {
  const res = await fetch(c.url);
  const buffer = (await res.arrayBuffer()) as ArrayBuffer;
  if (c.isVideo) {
    const { videoId } = await uploadVideoToMeta(accountId, token, buffer, c.originalName);
    return { videoId };
  } else {
    const { hash } = await uploadImageToMeta(accountId, token, buffer, c.originalName);
    return { imageHash: hash };
  }
}

async function launchBatch(
  batchId: string,
  token: string,
  accountId: string,
  pageId: string,
  instagramAccountId: string,
  rows: any[],
  disableEnhancements: boolean,
  launchAsActive = false
) {
  let launched = 0;

  for (const row of rows) {
    try {
      const link = row.destinationUrl || "https://example.com";
      const cta = resolveCta(row.cta || "LEARN_MORE", link);

      const vertical = row.creatives.find((c: any) => c.aspectRatio === "9:16");
      const square   = row.creatives.find((c: any) => c.aspectRatio === "1:1" || c.aspectRatio === "4:5");

      const crBody: Record<string, string> = { name: row.name };
      let primaryCreativeUrl = "";
      let primaryIsVideo = false;

      if (vertical && square) {
        // ── Multi-format ad: asset_feed_spec with placement rules ──────────
        const [vertAsset, sqAsset] = await Promise.all([
          uploadCreative(vertical, accountId, token),
          uploadCreative(square, accountId, token),
        ]);

        // Wait for any videos to finish processing
        if (vertical.isVideo && vertAsset.videoId) {
          const { ready } = await waitForVideo(vertAsset.videoId, token, 45000);
          if (!ready) throw new Error("9:16 video did not finish processing in time");
        }
        if (square.isVideo && sqAsset.videoId) {
          const { ready } = await waitForVideo(sqAsset.videoId, token, 45000);
          if (!ready) throw new Error("1:1 video did not finish processing in time");
        }

        const videos: any[] = [];
        const images: any[] = [];

        if (vertical.isVideo) {
          videos.push({ video_id: vertAsset.videoId, adlabels: [{ name: "vertical" }] });
        } else {
          images.push({ hash: vertAsset.imageHash, adlabels: [{ name: "vertical" }] });
        }
        if (square.isVideo) {
          videos.push({ video_id: sqAsset.videoId, adlabels: [{ name: "feed" }] });
        } else {
          images.push({ hash: sqAsset.imageHash, adlabels: [{ name: "feed" }] });
        }

        const vertLabel = vertical.isVideo ? "video_label" : "image_label";
        const sqLabel   = square.isVideo   ? "video_label" : "image_label";

        const assetFeedSpec: any = {
          call_to_action_types: [cta],
          link_urls: [{ website_url: link }],
          asset_customization_rules: [
            {
              customization_spec: {
                publisher_platforms: ["instagram", "facebook"],
                instagram_positions: ["story", "reels"],
                facebook_positions: ["story", "facebook_reels"],
              },
              [vertLabel]: { name: "vertical" },
            },
            {
              customization_spec: {
                publisher_platforms: ["instagram", "facebook"],
                instagram_positions: ["stream"],
                facebook_positions: ["feed"],
              },
              [sqLabel]: { name: "feed" },
            },
          ],
        };
        if (row.primaryText) assetFeedSpec.bodies = [{ text: row.primaryText }];
        if (row.headline)    assetFeedSpec.titles = [{ text: row.headline }];
        if (videos.length)   assetFeedSpec.videos = videos;
        if (images.length)   assetFeedSpec.images = images;

        const storySpec: any = { page_id: pageId };
        if (instagramAccountId) storySpec.instagram_actor_id = instagramAccountId;

        crBody.object_story_spec = JSON.stringify(storySpec);
        crBody.asset_feed_spec   = JSON.stringify(assetFeedSpec);

        primaryCreativeUrl = vertical.url || square.url || "";
        primaryIsVideo     = vertical.isVideo;
      } else {
        // ── Single-creative ad (fallback) ───────────────────────────────────
        const primary = vertical || square || row.creatives[0];
        if (!primary) throw new Error("No creative found in row");

        const primaryAsset = await uploadCreative(primary, accountId, token);
        primaryCreativeUrl = primary.url || "";
        primaryIsVideo     = primary.isVideo;

        let videoThumbnailUrl: string | undefined;
        if (primary.isVideo && primaryAsset.videoId) {
          const { ready, thumbnailUrl } = await waitForVideo(primaryAsset.videoId, token, 30000);
          if (!ready) throw new Error(`Video ${primaryAsset.videoId} did not finish processing`);
          videoThumbnailUrl = thumbnailUrl;
        }

        let storySpec: Record<string, any>;
        if (primary.isVideo) {
          storySpec = {
            page_id: pageId,
            video_data: {
              video_id: primaryAsset.videoId,
              image_url: videoThumbnailUrl,
              message: row.primaryText || undefined,
              title: row.headline || undefined,
              call_to_action: { type: cta, value: { link } },
            },
          };
        } else {
          storySpec = {
            page_id: pageId,
            link_data: {
              image_hash: primaryAsset.imageHash,
              link,
              message: row.primaryText || undefined,
              name: row.headline || undefined,
              call_to_action: { type: cta, value: { link } },
            },
          };
        }
        if (instagramAccountId) storySpec.instagram_actor_id = instagramAccountId;

        crBody.object_story_spec = JSON.stringify(storySpec);
      }

      if (disableEnhancements) {
        crBody.creative_features_spec = JSON.stringify({
          standard_enhancements: { enroll_status: "OPT_OUT" },
        });
      }

      console.log("[launch] Creating creative for:", row.name);
      const cr = await metaPost(`/act_${accountId}/adcreatives`, token, crBody);
      console.log("[launch] Creative response:", JSON.stringify(cr));
      if (!cr.id) {
        const msg = cr.error?.error_user_msg || cr.error?.message || JSON.stringify(cr.error);
        throw new Error(`Creative failed: ${msg}`);
      }

      if (!row.adSetId) throw new Error("No ad set ID assigned to this row");

      const adPayload: Record<string, string> = {
        name: row.name,
        adset_id: row.adSetId,
        creative: JSON.stringify({ creative_id: cr.id }),
        status: launchAsActive ? "ACTIVE" : "PAUSED",
      };
      if (row.scheduledAt) adPayload.start_time = new Date(row.scheduledAt).toISOString();

      console.log("[launch] Creating ad:", JSON.stringify(adPayload));
      const ar = await metaPost(`/act_${accountId}/ads`, token, adPayload);
      console.log("[launch] Ad response:", JSON.stringify(ar));
      if (!ar.id) {
        const msg = ar.error?.error_user_msg || ar.error?.message || JSON.stringify(ar);
        const sub = ar.error?.error_subcode ? ` [subcode ${ar.error.error_subcode}]` : "";
        throw new Error(`Ad failed${sub}: ${msg}`);
      }

      await prisma.ad.create({
        data: {
          batchId,
          name: row.name,
          adSetId: row.adSetId,
          primaryText: row.primaryText,
          headline: row.headline,
          cta: row.cta,
          destinationUrl: row.destinationUrl,
          creativeUrl: primaryCreativeUrl,
          creativeType: primaryIsVideo ? "video" : "image",
          metaAdId: ar.id,
          metaCreativeId: cr.id,
          status: "launched",
          scheduledAt: row.scheduledAt ? new Date(row.scheduledAt) : null,
        },
      });

      launched++;
      await prisma.adBatch.update({
        where: { id: batchId },
        data: { launchedAds: launched },
      });
    } catch (err: any) {
      console.error("Ad launch error:", err.message);
      await prisma.ad.create({
        data: {
          batchId,
          name: row.name,
          adSetId: row.adSetId,
          status: "error",
          errorMessage: err.message,
        },
      });
    }
  }

  await prisma.adBatch.update({
    where: { id: batchId },
    data: { status: "done" },
  });
}

// GET /api/launch?batchId=xxx — poll launch progress
export async function GET(req: NextRequest) {
  const batchId = req.nextUrl.searchParams.get("batchId");
  if (!batchId) return NextResponse.json({ error: "Missing batchId" }, { status: 400 });

  try {
    const batch = await prisma.adBatch.findFirst({
      where: { id: batchId },
      include: { ads: { orderBy: { createdAt: "desc" } } },
    });
    if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(batch);
  } catch {
    return NextResponse.json({ error: "Database not available" }, { status: 500 });
  }
}
