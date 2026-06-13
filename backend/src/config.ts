import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/astrology_app",
  jwtSecret: process.env.JWT_SECRET ?? "change-me",
  adminEmail: process.env.ADMIN_EMAIL ?? "admin@example.com",
  adminPassword: process.env.ADMIN_PASSWORD ?? "admin12345",
  aspectAccessPrice: Number(process.env.ASPECT_ACCESS_PRICE ?? 49000),
  aspectAccessCurrency: process.env.ASPECT_ACCESS_CURRENCY ?? "VND",
  aspectAccessTtlMinutes: Number(process.env.ASPECT_ACCESS_TTL_MINUTES ?? 10080),
  aspectAccessPriceUsd: Number(process.env.ASPECT_ACCESS_PRICE_USD ?? 5),
  vietQrTransferContent: process.env.VIETQR_TRANSFER_CONTENT ?? "natalchart",
  vietQrQrImageUrl: process.env.VIETQR_QR_IMAGE_URL ?? "",
  vietQrWebhookApiKey: process.env.VIETQR_WEBHOOK_API_KEY ?? "",
  vietQrSessionTtlMinutes: Number(process.env.VIETQR_SESSION_TTL_MINUTES ?? 30),
  paypalUnlockUrl: process.env.PAYPAL_UNLOCK_URL ?? "",
  paypalClientId:
    process.env.PAYPAL_CLIENT_ID ??
    "BAAMJ4zbNL6qXEev69zUKgAia2PQ8fhPdHz4ITfxmDZKr1ww7gpmO1D7fhCqVBIb_uKFdN9vlWyhvM1Qs0",
  paypalHostedButtonId: process.env.PAYPAL_HOSTED_BUTTON_ID ?? "BEDQ4XH9ANHDY",
  paypalCurrency: process.env.PAYPAL_CURRENCY ?? "AUD",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  paypalReturnPath: process.env.PAYPAL_RETURN_PATH ?? "/",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini"
};
