import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { config } from "./config.js";

const app = createApp();

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(config.port, "0.0.0.0", () => {
    console.log(`Romana admin API is running at http://localhost:${config.port}`);
    if (!config.supabaseUrl || !config.supabaseKey || config.adminEmails.length === 0) {
      console.log("Supabase setup required: add SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and ADMIN_EMAILS to backend/.env");
    }
  });
}

export { app };
