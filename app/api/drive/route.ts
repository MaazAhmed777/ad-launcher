import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.NEXT_PUBLIC_URL + "/api/drive/callback";

// GET /api/drive?action=auth — get OAuth URL
// GET /api/drive?action=list&folderId=xxx&token=xxx — list files
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");

  if (action === "auth") {
    const url = new URL(DRIVE_AUTH);
    url.searchParams.set("client_id", CLIENT_ID);
    url.searchParams.set("redirect_uri", REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "https://www.googleapis.com/auth/drive.readonly");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    return NextResponse.json({ url: url.toString() });
  }

  if (action === "list") {
    const folderId = req.nextUrl.searchParams.get("folderId");
    const driveToken = req.nextUrl.searchParams.get("token");
    if (!folderId || !driveToken)
      return NextResponse.json({ error: "Missing folderId or token" }, { status: 400 });

    const SUPPORTED_MIMES = [
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "video/mp4", "video/quicktime", "video/x-msvideo", "video/webm",
    ];
    const query = `'${folderId}' in parents and trashed=false and (${SUPPORTED_MIMES.map(m => `mimeType='${m}'`).join(" or ")})`;

    const res = await fetch(
      `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size)&pageSize=200`,
      { headers: { Authorization: `Bearer ${driveToken}` } }
    );
    const data = await res.json();
    if (!res.ok) {
      console.error("Drive list error:", JSON.stringify(data));
      return NextResponse.json({ error: data.error?.message || "Drive API error", details: data }, { status: res.status });
    }
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

// POST /api/drive — exchange code for token, or import file
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.action === "exchange") {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: body.code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    return NextResponse.json(await res.json());
  }

  if (body.action === "import") {
    const { fileId, filename, driveToken } = body;

    const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${driveToken}` },
    });
    if (!res.ok) return NextResponse.json({ error: "Drive download failed" }, { status: 500 });

    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = path.extname(filename).toLowerCase();
    const isVideo = [".mp4", ".mov", ".avi", ".webm"].includes(ext);

    const result = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: isVideo ? "video" : "image", folder: "ad-launcher" },
        (error, result) => { if (error) reject(error); else resolve(result); }
      );
      stream.end(buffer);
    });

    const sizeLabel = buffer.length < 1024 * 1024
      ? `${(buffer.length / 1024).toFixed(0)} KB`
      : `${(buffer.length / 1024 / 1024).toFixed(1)} MB`;

    return NextResponse.json({
      uploaded: [{ filename: result.public_id, originalName: filename, url: result.secure_url, isVideo, sizeLabel }],
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
