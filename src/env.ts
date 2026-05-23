export const ADMIN_ID = parseInt(process.env.ADMIN_ID ?? "", 10);

if (!ADMIN_ID) {
  console.error("❌ ADMIN_ID is not set or invalid in environment variables");
  process.exit(1);
}
