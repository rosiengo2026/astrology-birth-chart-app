import mongoose, { InferSchemaType } from "mongoose";
import { MeaningCategory } from "../types";

const meaningSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ["planet_sign", "planet_house", "aspect", "house", "house_sign"] satisfies MeaningCategory[],
      required: true
    },
    key: { type: String, required: true, trim: true },
    title: {
      en: { type: String, required: true, trim: true },
      vi: { type: String, required: true, trim: true }
    },
    content: {
      en: { type: String, required: true },
      vi: { type: String, required: true }
    }
  },
  { timestamps: true }
);

meaningSchema.index({ category: 1, key: 1 }, { unique: true });

export type MeaningDocument = InferSchemaType<typeof meaningSchema>;

export const MeaningModel = mongoose.model("Meaning", meaningSchema);
