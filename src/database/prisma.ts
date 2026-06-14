import { PrismaClient } from "@prisma-generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@config/env";

const adapter = new PrismaPg({ connectionString: env.database.url });

const prismaClient = new PrismaClient({
  adapter,
  log: ["warn", "error"],
});

export default prismaClient;
