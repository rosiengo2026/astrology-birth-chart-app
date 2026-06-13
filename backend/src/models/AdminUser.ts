import mongoose, { InferSchemaType } from "mongoose";

const adminUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true }
  },
  { timestamps: true }
);

export type AdminUserDocument = InferSchemaType<typeof adminUserSchema>;

export const AdminUserModel = mongoose.model("AdminUser", adminUserSchema);
