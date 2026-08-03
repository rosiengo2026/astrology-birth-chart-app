import mongoose, { InferSchemaType } from "mongoose";
import { ADMIN_ROLES } from "../types/adminRoles";

const adminUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    /** Plaintext copy for admin panel display only — not used for auth. */
    passwordPlain: { type: String, default: "" },
    role: { type: String, enum: ADMIN_ROLES, default: "member" },
    permissions: { type: [String], default: [] }
  },
  { timestamps: true }
);

export type AdminUserDocument = InferSchemaType<typeof adminUserSchema>;

export const AdminUserModel = mongoose.model("AdminUser", adminUserSchema);
