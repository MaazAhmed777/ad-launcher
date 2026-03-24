import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ accounts: [] });

  const accounts = await prisma.metaAdAccount.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ accounts });
}

export async function PATCH(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ ok: false });

  const { accountId } = await req.json();
  await prisma.metaAdAccount.updateMany({ where: { userId: user.id }, data: { isActive: false } });
  await prisma.metaAdAccount.updateMany({
    where: { userId: user.id, accountId },
    data: { isActive: true },
  });
  return NextResponse.json({ ok: true });
}
