import { getServerSession } from "next-auth";
import { authOptions } from "./auth-options";

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function getCurrentUserId(): Promise<string | null> {
  const session = await getSession();
  return (session?.user as { id?: string })?.id ?? null;
}

export async function requireAuth(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}
