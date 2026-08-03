import mongoose from "mongoose";
import { config } from "./config";

let databaseReady = false;
let connecting = false;
let lastConnectionAttemptAt = 0;
let hasLoggedUnavailable = false;
const RETRY_INTERVAL_MS = 60_000;

export function isDatabaseReady(): boolean {
  return databaseReady;
}

export async function connectDatabase(): Promise<boolean> {
  if (databaseReady) {
    return true;
  }
  if (connecting) {
    return false;
  }
  if (Date.now() - lastConnectionAttemptAt < RETRY_INTERVAL_MS) {
    return false;
  }

  connecting = true;
  lastConnectionAttemptAt = Date.now();
  mongoose.set("bufferCommands", false);

  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000
    });

    console.log("Mongo database:", mongoose.connection.name);
    databaseReady = true;
    hasLoggedUnavailable = false;
    return true;
  } catch (error) {
    databaseReady = false;
    if (!hasLoggedUnavailable) {
      // eslint-disable-next-line no-console
      console.warn("MongoDB not available. Using local fallback store for CMS/login.");
      // eslint-disable-next-line no-console
      console.warn(error);
      hasLoggedUnavailable = true;
    }
    return false;
  } finally {
    connecting = false;
  }
}
