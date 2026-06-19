import { initDb, closeDb } from "../server/db";
import { hashPassword } from "../server/auth";
import { storage } from "../server/storage";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const adminUsername = process.env.SEED_ADMIN_USERNAME;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminUsername || !adminPassword) {
    throw new Error("SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD are required");
  }

  await initDb(databaseUrl);

  await storage.upsertScreener("pe-evaluator", "PE Evaluator", "P/E ratio history and hypothetical trade tracking");

  const existing = await storage.getUserByUsername(adminUsername);
  if (existing) {
    console.log(`User '${adminUsername}' already exists, skipping admin creation.`);
  } else {
    const hashed = await hashPassword(adminPassword);
    await storage.createUser({ username: adminUsername, password: hashed, role: "admin" });
    console.log(`Created admin user '${adminUsername}'.`);
  }

  await closeDb();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
