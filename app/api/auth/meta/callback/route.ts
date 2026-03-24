import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { metaGet } from "@/lib/meta";
import { cookies } from "next/headers";

const APP_ID = process.env.META_APP_ID!;
const APP_SECRET = process.env.META_APP_SECRET!;
const REDIRECT_URI = process.env.NEXT_PUBLIC_URL + "/api/auth/meta/callback";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/?error=no_code", req.url));

  // Exchange code for short-lived token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?` +
    new URLSearchParams({ client_id: APP_ID, client_secret: APP_SECRET, redirect_uri: REDIRECT_URI, code })
  );
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) return NextResponse.redirect(new URL("/?error=token_fail", req.url));

  // Exchange for long-lived token (60 days)
  const longRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?` +
    new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: APP_ID,
      client_secret: APP_SECRET,
      fb_exchange_token: tokenData.access_token,
    })
  );
  const longData = await longRes.json();
  const token = longData.access_token || tokenData.access_token;
  const expiresIn = longData.expires_in || 5184000;

  // Fetch user info
  const me = await metaGet("/me", token, { fields: "id,name,email" });
  if (!me.id) return NextResponse.redirect(new URL("/?error=user_fail", req.url));

  // Upsert user
  const user = await prisma.user.upsert({
    where: { metaUserId: me.id },
    update: {
      name: me.name,
      email: me.email,
      metaToken: token,
      tokenExpiry: new Date(Date.now() + expiresIn * 1000),
    },
    create: {
      metaUserId: me.id,
      name: me.name,
      email: me.email,
      metaToken: token,
      tokenExpiry: new Date(Date.now() + expiresIn * 1000),
    },
  });

  // Fetch and store ad accounts
  const accounts = await metaGet("/me/adaccounts", token, {
    fields: "name,account_id,currency,timezone_name",
    limit: "50",
  });

  if (accounts.data) {
    for (const acc of accounts.data) {
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
    // Auto-activate first account if none active
    const existing = await prisma.metaAdAccount.findFirst({ where: { userId: user.id, isActive: true } });
    if (!existing && accounts.data.length > 0) {
      await prisma.metaAdAccount.updateMany({
        where: { userId: user.id, accountId: accounts.data[0].account_id },
        data: { isActive: true },
      });
    }
  }

  const cookieStore = await cookies();
  cookieStore.set("ml_user_id", user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 60,
    path: "/",
  });

  return NextResponse.redirect(new URL("/launch", req.url));
}
