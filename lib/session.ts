import { cookies } from "next/headers";
import { prisma } from "./prisma";

export async function getSession() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("ml_user_id")?.value;
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { adAccounts: { where: { isActive: true }, take: 1 } },
  });
  return user;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}
