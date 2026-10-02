import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { __invtraPrisma?: PrismaClient };

export const db: PrismaClient =
  globalForPrisma.__invtraPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.__invtraPrisma = db;
