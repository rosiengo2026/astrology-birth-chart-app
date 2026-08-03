import crypto from "crypto";
import fs from "fs";
import multer from "multer";
import path from "path";

export const UPLOADS_DIR = path.resolve(process.cwd(), "data", "uploads");

export function ensureUploadsDir(): void {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const allowedExt = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);

const imageFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExt.has(ext)) {
    cb(new Error("Only PNG, JPEG, GIF, WebP, or SVG files are allowed."));
    return;
  }
  const mime = file.mimetype.toLowerCase();
  const mimeOk =
    mime === "image/png" ||
    mime === "image/jpeg" ||
    mime === "image/jpg" ||
    mime === "image/gif" ||
    mime === "image/webp" ||
    mime === "image/svg+xml";
  if (!mimeOk) {
    cb(new Error("Invalid image MIME type."));
    return;
  }
  cb(null, true);
};

function buildImageUpload(prefix: string, maxBytes: number): multer.Multer {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        ensureUploadsDir();
        cb(null, UPLOADS_DIR);
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const useExt = allowedExt.has(ext) ? ext : ".png";
        cb(null, `${prefix}-${Date.now()}-${crypto.randomBytes(8).toString("hex")}${useExt}`);
      }
    }),
    limits: { fileSize: maxBytes },
    fileFilter: imageFileFilter
  });
}

/** Logo and small branding assets (max 2 MB). */
export const logoUpload = buildImageUpload("logo", 2 * 1024 * 1024);

/** VietQR payment QR codes (max 2 MB). */
export const vietqrUpload = buildImageUpload("vietqr", 2 * 1024 * 1024);

/** PayPal payment QR codes (max 2 MB). */
export const paypalQrUpload = buildImageUpload("paypal-qr", 2 * 1024 * 1024);

/** Full-page background artwork (max 4 MB). */
export const backgroundUpload = buildImageUpload("bg", 4 * 1024 * 1024);
