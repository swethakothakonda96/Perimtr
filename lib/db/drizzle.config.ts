import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env from repo root (two levels up from lib/db/)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../.env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Copy .env.example to .env and fill in your Postgres connection string.");
}

export default defineConfig({
  schema: "./src/schema/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
