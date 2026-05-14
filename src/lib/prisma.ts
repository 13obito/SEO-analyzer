import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** Silence pg driver warning: require/prefer/verify-ca are temporary aliases for verify-full until pg v9. */
function normalizeDatabaseUrlForPgSsl(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol !== "postgresql:" && u.protocol !== "postgres:") return url;
    const mode = u.searchParams.get("sslmode");
    if (
      mode === "require" ||
      mode === "prefer" ||
      mode === "verify-ca"
    ) {
      u.searchParams.set("sslmode", "verify-full");
      return u.toString();
    }
  } catch {
    /* invalid URL — use raw */
  }
  return url;
}

function createPrismaClient() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error(
      "DATABASE_URL is not set. Add a PostgreSQL URL to .env (see .env.example)."
    );
  }
  if (rawUrl.startsWith("file:")) {
    throw new Error(
      "DATABASE_URL uses SQLite (file:...). This app expects PostgreSQL. Replace with postgresql://... run: npx prisma migrate dev"
    );
  }
  const url = normalizeDatabaseUrlForPgSsl(rawUrl);
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = undefined;
}

export const prisma =
  process.env.NODE_ENV === "production"
    ? (globalForPrisma.prisma ??= createPrismaClient())
    : createPrismaClient();
