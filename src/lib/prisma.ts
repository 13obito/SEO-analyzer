import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add a PostgreSQL URL to .env (see .env.example)."
    );
  }
  if (url.startsWith("file:")) {
    throw new Error(
      "DATABASE_URL uses SQLite (file:...). This app expects PostgreSQL. Replace with postgresql://... run: npx prisma migrate dev"
    );
  }
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
