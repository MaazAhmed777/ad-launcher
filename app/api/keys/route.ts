import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

const PREVIEW_USER = "preview";

export async function GET() {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId: PREVIEW_USER },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ keys });
  } catch {
    return NextResponse.json({ keys: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    const key = await prisma.apiKey.create({
      data: { userId: PREVIEW_USER, key: `ml_${uuidv4().replace(/-/g, "")}`, name },
    });
    return NextResponse.json({ key });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    await prisma.apiKey.delete({ where: { id: id! } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
