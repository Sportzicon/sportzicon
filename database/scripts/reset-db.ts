// Drops and recreates all tables by running `prisma migrate reset`.
// Use this when you want a clean slate including schema changes.
// For just clearing data (keeping schema), use truncate.ts instead.
import { execSync } from "child_process";
import path from "path";

const schemaPath = path.resolve(__dirname, "../prisma/schema.prisma");

console.log("Resetting database (drop + migrate + seed)…");

try {
  execSync(`npx prisma migrate reset --force --schema="${schemaPath}"`, {
    stdio: "inherit",
    env: { ...process.env }
  });
  console.log("✅ Database reset complete.");
} catch (err) {
  console.error("Reset failed:", err);
  process.exit(1);
}
