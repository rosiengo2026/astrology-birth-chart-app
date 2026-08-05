import cors from "cors";
import express from "express";
import { config } from "./config";
import { connectDatabase } from "./db";
import { ensureUploadsDir, UPLOADS_DIR } from "./middleware/logoUpload";
import router from "./routes";
import { ensureDefaultAdminUser, ensureDefaultLocalAdminUser } from "./services/adminService";

async function bootstrap() {
  const dbReady = await connectDatabase();
  if (dbReady) {
    await ensureDefaultAdminUser();
  } else {
    await ensureDefaultLocalAdminUser();
  }

  ensureUploadsDir();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/uploads", express.static(UPLOADS_DIR));
  app.use("/api", router);

  app.listen(config.port, () => {
    console.log("=== BUILD 9cb146d ===");
    // eslint-disable-next-line no-console
    console.log(`Backend running on http://localhost:${config.port}`);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server", error);
  process.exit(1);
});
