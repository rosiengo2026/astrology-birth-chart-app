import mongoose, { InferSchemaType } from "mongoose";

const paymentSettingsSchema = new mongoose.Schema(
  {
    vietqrImageUrl: { type: String, default: "" },
    vietqrInstructionsVi: { type: String, default: "" },
    vietqrInstructionsEn: { type: String, default: "" },
    /** PayPal checkout / donate link (hosted button). Overrides PAYPAL_UNLOCK_URL from env when non-empty. */
    paypalUnlockUrl: { type: String, default: "" },
    paypalQrImageUrl: { type: String, default: "" },
    /** VietQR amount (VND). 0 = use ASPECT_ACCESS_PRICE from env. */
    aspectUnlockPriceVnd: { type: Number, default: 0 },
    /** PayPal reference amount (USD). 0 = use ASPECT_ACCESS_PRICE_USD from env. */
    aspectUnlockPriceUsd: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export type PaymentSettingsDocument = InferSchemaType<typeof paymentSettingsSchema>;

export const PaymentSettingsModel = mongoose.model("PaymentSettings", paymentSettingsSchema);
