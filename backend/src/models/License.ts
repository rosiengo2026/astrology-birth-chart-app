import mongoose, { InferSchemaType } from "mongoose";

const licenseSchema = new mongoose.Schema(
  {
    licenseKey: { type: String, required: true, unique: true, trim: true },
    /** One-time PIN shown in admin; required at /admin/setup together with the key (legacy docs may omit). */
    licensePin: { type: String, default: "" },
    isUsed: { type: Boolean, default: false },
    /** Admin created when this license was redeemed (one admin per license). */
    adminUserId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", default: null },
    usedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export type LicenseDocument = InferSchemaType<typeof licenseSchema>;

export const LicenseModel = mongoose.model("License", licenseSchema);
