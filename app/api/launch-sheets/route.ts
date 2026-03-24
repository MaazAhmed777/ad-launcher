import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { metaPost, uploadImageToMeta, uploadVideoToMeta } from "@/lib/meta";
import { readFile, mkdir } from "fs/promises";
import { writeFile } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

/**
 * POST /api/launch-sheets
 * API-key authenticated endpoint for Google Sheets integration.
 *
 * Headers: Authorization: Bearer ml_xxxx
 *
 * Body: Array of ad objects:
 * [
 *   {
 *     creative_url: "https://...",     // public URL to image/video
 *     ad_name: "My Ad",
 *     primary_text: "...",
 *     headline: "...",
 *     cta: "LEARN_MORE",
 *     destination_url: "https://...",
 *     ad_set_id: "123456",
 *     page_id: "123456",
 *     account_id: "123456",
 *     scheduled_time: "2024-01-01T10:00:00Z"   // optional
 *   }
 * ]
 *
 * Returns: Array of {index, status, ad_id?, error?}
 */
export async function POST(req: NextRequest) {
  // API key auth
  const authHeader = req.headers.get("Authorization") || "";
  const apiKey = authHeader.replace("Bearer ", "").trim();
  if (!apiKey) return NextResponse.json({ error: "Missing API key" }, { status: 401 });

  const keyRecord = await prisma.apiKey.findUnique({
    where: { key: apiKey },
    include: { user: true },
  });
  if (!keyRecord) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  await prisma.apiKey.update({ where: { key: apiKey }, data: { lastUsed: new Date() } });

  const user = keyRecord.user;
  if (!user.metaToken) return NextResponse.json({ error: "No Meta token on file" }, { status: 400 });

  const rows = await req.json();
  if (!Array.isArray(rows)) return NextResponse.json({ error: "Body must be an array" }, { status: 400 });

  const results = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const { creative_url, ad_name, primary_text, headline, cta, destination_url, ad_set_id, page_id, account_id, scheduled_time } = row;

      // Download creative from URL
      await mkdir(UPLOAD_DIR, { recursive: true });
      const dlRes = await fetch(creative_url);
      if (!dlRes.ok) throw new Error(`Could not download creative: ${creative_url}`);
      const buffer = await dlRes.arrayBuffer();
      const ext = path.extname(new URL(creative_url).pathname).toLowerCase() || ".jpg";
      const safe = `${uuidv4()}${ext}`;
      await writeFile(path.join(UPLOAD_DIR, safe), Buffer.from(buffer));

      const isVideo = [".mp4", ".mov", ".avi", ".webm"].includes(ext);

      let crBody: Record<string, string>;
      if (isVideo) {
        const { videoId } = await uploadVideoToMeta(account_id, user.metaToken, buffer, safe);
        crBody = {
          name: ad_name,
          object_story_spec: JSON.stringify({
            page_id,
            video_data: {
              video_id: videoId,
              message: primary_text,
              title: headline,
              call_to_action: { type: cta || "LEARN_MORE", value: { link: destination_url } },
            },
          }),
        };
      } else {
        const { hash } = await uploadImageToMeta(account_id, user.metaToken, buffer, safe);
        crBody = {
          name: ad_name,
          object_story_spec: JSON.stringify({
            page_id,
            link_data: {
              image_hash: hash,
              message: primary_text,
              link: destination_url,
              name: headline,
              call_to_action: { type: cta || "LEARN_MORE" },
            },
          }),
        };
      }

      const cr = await metaPost(`/act_${account_id}/adcreatives`, user.metaToken, crBody);
      if (!cr.id) throw new Error(cr.error?.message || "Creative creation failed");

      const adPayload: Record<string, string> = {
        name: ad_name,
        adset_id: ad_set_id,
        creative: JSON.stringify({ creative_id: cr.id }),
        status: "PAUSED",
      };
      if (scheduled_time) adPayload.start_time = new Date(scheduled_time).toISOString();

      const ar = await metaPost(`/act_${account_id}/ads`, user.metaToken, adPayload);
      if (!ar.id) throw new Error(ar.error?.message || "Ad creation failed");

      results.push({ index: i, status: "success", ad_id: ar.id });
    } catch (err: any) {
      results.push({ index: i, status: "error", error: err.message });
    }
  }

  return NextResponse.json({ results });
}
