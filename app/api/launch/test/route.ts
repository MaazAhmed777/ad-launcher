import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { uploadImageToMeta, uploadVideoToMeta } from "@/lib/meta";
const META_API = "https://graph.facebook.com/v19.0";

// Like metaPost but returns both the response AND the exact payload sent
async function metaPostDebug(endpoint: string, token: string, body: Record<string, string>) {
  const url = `${META_API}${endpoint}`;
  const form = new URLSearchParams({ ...body, access_token: token });
  const res = await fetch(url, {
    method: "POST",
    body: form,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  const data = await res.json();
  // Return payload without token for security
  const { access_token: _t, ...safeBody } = Object.fromEntries(form.entries());
  return { data, sentPayload: safeBody };
}

// Poll video until ready, then return status + thumbnail URL
async function waitForVideo(videoId: string, token: string, maxMs = 30000): Promise<{ ready: boolean; statusData: any; thumbnailUrl?: string }> {
  const interval = 3000;
  const attempts = Math.ceil(maxMs / interval);
  let statusData: any = null;
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, interval));
    const res = await fetch(`${META_API}/${videoId}?fields=status,picture&access_token=${token}`);
    statusData = await res.json();
    const vs = statusData?.status?.video_status;
    if (vs === "ready") return { ready: true, statusData, thumbnailUrl: statusData.picture };
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
  const { accountId, pageId, instagramAccountId, rows } = body;

  if (!user?.metaToken) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const token = user.metaToken;
  const actId = accountId || user.adAccounts?.[0]?.accountId;
  const row = rows?.[0];
  if (!row) return NextResponse.json({ error: "No rows provided" });

  const primary =
    row.creatives.find((c: any) => c.aspectRatio === "9:16") ||
    row.creatives.find((c: any) => c.aspectRatio === "1:1" || c.aspectRatio === "4:5") ||
    row.creatives[0];

  if (!primary) return NextResponse.json({ error: "No creatives in row" });

  const steps: any[] = [];
  const link = row.destinationUrl || "https://example.com";
  let cta = row.cta || "LEARN_MORE";

  // DOWNLOAD CTA requires an App Store / Google Play URL
  if (cta === "DOWNLOAD" && !isAppStoreUrl(link)) {
    steps.push({ step: "cta_warning", message: `CTA is DOWNLOAD but URL is not an app store URL — falling back to LEARN_MORE`, originalCta: cta, url: link });
    cta = "LEARN_MORE";
  }

  steps.push({ step: "config", actId, pageId, instagramAccountId, cta, url: link, creative: { name: primary.originalName, isVideo: primary.isVideo, aspectRatio: primary.aspectRatio } });

  try {
    const fileRes = await fetch(primary.url);
    const buffer = (await fileRes.arrayBuffer()) as ArrayBuffer;
    steps.push({ step: "read_file", ok: true, bytes: buffer.byteLength });

    let asset: { videoId?: string; imageHash?: string };
    if (primary.isVideo) {
      const { videoId } = await uploadVideoToMeta(actId, token, buffer, primary.originalName);
      asset = { videoId };
      steps.push({ step: "upload_video", ok: true, videoId });

      // Poll until video is ready (up to 30s)
      const { ready, statusData, thumbnailUrl } = await waitForVideo(videoId!, token, 30000);
      steps.push({ step: "video_status", ready, thumbnailUrl, status: statusData });
      if (!ready) {
        return NextResponse.json({ ok: false, error: "Video did not finish processing in time", steps });
      }
      if (thumbnailUrl) asset = { ...asset, thumbnailUrl } as any;
    } else {
      const { hash } = await uploadImageToMeta(actId, token, buffer, primary.originalName);
      asset = { imageHash: hash };
      steps.push({ step: "upload_image", ok: true, hash });
    }

    // Build minimal story spec
    let storySpec: Record<string, any>;
    if (primary.isVideo) {
      storySpec = {
        page_id: pageId,
        video_data: {
          video_id: asset.videoId,
          image_url: (asset as any).thumbnailUrl,
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

    const crBody = { name: row.name, object_story_spec: JSON.stringify(storySpec) };
    steps.push({ step: "build_creative", storySpec });

    const { data: cr, sentPayload } = await metaPostDebug(`/act_${actId}/adcreatives`, token, crBody);
    steps.push({ step: "create_creative", sentPayload, response: cr });

    if (cr.id) {
      return NextResponse.json({ ok: true, creativeId: cr.id, steps });
    } else {
      return NextResponse.json({ ok: false, metaError: cr.error, steps });
    }
  } catch (err: any) {
    steps.push({ step: "exception", error: err.message });
    return NextResponse.json({ ok: false, error: err.message, steps });
  }
}
