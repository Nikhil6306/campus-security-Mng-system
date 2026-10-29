import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

try {
  const out = execSync("supabase projects api-keys --project-ref qpamgfhggxwctoibmsbl", {
    encoding: "utf8",
  });
  const jsonMatch = out.match(/\{[\s\S]*"keys"[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("Could not find JSON in output");
    process.exit(1);
  }
  const parsed = JSON.parse(jsonMatch[0]);
  const anon = parsed.keys.find((k) => k.id === "anon" || k.name === "anon")?.api_key;
  const service = parsed.keys.find((k) => k.id === "service_role" || k.name === "service_role")?.api_key;

  if (!anon || !service) {
    console.error("Could not find keys in JSON");
    process.exit(1);
  }

  const env = [
    "NEXT_PUBLIC_APP_URL=http://localhost:3000",
    "DATABASE_FILE=.data/campus-security.db",
    "NEXT_PUBLIC_SUPABASE_URL=https://qpamgfhggxwctoibmsbl.supabase.co",
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`,
    `SUPABASE_SERVICE_ROLE_KEY=${service}`,
    "WHATSAPP_PROVIDER=mock",
    "",
  ].join("\n");

  writeFileSync(".env.local", env, "utf8");
  console.log("Successfully wrote .env.local with credentials.");
} catch (err) {
  console.error("Setup error:", err.message);
  process.exit(1);
}
