import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token?.trim()) return NextResponse.json({ error: "Token is required" }, { status: 400 });

  // Validate token by calling Meta /me
  const res = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${token}`);
  const me = await res.json();
  if (!me.id) return NextResponse.json({ error: me.error?.message || "Invalid token" }, { status: 400 });

  // Fetch ad accounts
  const accountsRes = await fetch(
    `https://graph.facebook.com/v19.0/me/adaccounts?fields=name,account_id,currency,timezone_name&limit=50&access_token=${token}`
  );
  const accountsData = await accountsRes.json();

  // Upsert user
  const user = await prisma.user.upsert({
    where: { metaUserId: me.id },
    update: { name: me.name, metaToken: token, tokenExpiry: null },
    create: { metaUserId: me.id, name: me.name, metaToken: token, tokenExpiry: null },
  });

  // Upsert ad accounts
  if (accountsData.data) {
    for (const acc of accountsData.data) {
      await prisma.metaAdAccount.upsert({
        where: { userId_accountId: { userId: user.id, accountId: acc.account_id } },
        update: { name: acc.name, currency: acc.currency, timezone: acc.timezone_name },
        create: {
          userId: user.id,
          accountId: acc.account_id,
          name: acc.name,
          currency: acc.currency,
          timezone: acc.timezone_name,
          isActive: false,
        },
      });
    }
    const existing = await prisma.metaAdAccount.findFirst({ where: { userId: user.id, isActive: true } });
    if (!existing && accountsData.data.length > 0) {
      await prisma.metaAdAccount.updateMany({
        where: { userId: user.id, accountId: accountsData.data[0].account_id },
        data: { isActive: true },
      });
    }
  }

  const cookieStore = await cookies();
  cookieStore.set("ml_user_id", user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year — system tokens don't expire
    path: "/",
  });

  return NextResponse.json({ ok: true, name: me.name });
}
