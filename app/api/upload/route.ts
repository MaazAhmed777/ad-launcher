import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export async function POST(req: NextRequest) {

  await mkdir(UPLOAD_DIR, { recursive: true });

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  const uploaded = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name).toLowerCase();
    const safe = `${uuidv4()}${ext}`;
    await writeFile(path.join(UPLOAD_DIR, safe), buffer);

    const isVideo = [".mp4", ".mov", ".avi", ".webm"].includes(ext);
    uploaded.push({
      filename: safe,
      originalName: file.name,
      url: `/uploads/${safe}`,
      isVideo,
      sizeLabel: fmtSize(buffer.length),
    });
  }

  return NextResponse.json({ uploaded });
}
