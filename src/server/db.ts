import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { __invtraPrisma?: PrismaClient };

export const db: PrismaClient =
  globalForPrisma.__invtraPrisma ??
  new PrismaClient({
    log: ["warn"], // errors surface as exceptions and are logged by src/server/log.ts
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.__invtraPrisma = db;
