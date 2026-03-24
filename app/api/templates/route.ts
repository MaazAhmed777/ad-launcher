import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PREVIEW_USER = "preview";

export async function GET() {
  try {
    const templates = await prisma.adTemplate.findMany({
      where: { userId: PREVIEW_USER },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ templates });
  } catch {
    return NextResponse.json({ templates: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const template = await prisma.adTemplate.create({
      data: { userId: PREVIEW_USER, ...body },
    });
    return NextResponse.json({ template });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    const template = await prisma.adTemplate.update({ where: { id }, data });
    return NextResponse.json({ template });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    await prisma.adTemplate.delete({ where: { id: id! } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
