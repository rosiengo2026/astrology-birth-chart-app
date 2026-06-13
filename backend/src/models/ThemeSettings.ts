import mongoose, { InferSchemaType } from "mongoose";

const themeSettingsSchema = new mongoose.Schema(
  {
    logoUrl: { type: String, default: "" },
    /** Full-bleed background image (URL). Empty = front end uses default asset from CSS. */
    backgroundImageUrl: { type: String, default: "" },
    /** Main heading / brand text on the storefront (e.g. site name). */
    siteTitle: { type: String, default: "AstroScope" },
    backgroundColor: { type: String, default: "#020617" },
    surfaceColor: { type: String, default: "#0f172a" },
    panelBorderColor: { type: String, default: "#1e293b" },
    bodyTextColor: { type: String, default: "#e2e8f0" },
    mutedTextColor: { type: String, default: "#94a3b8" },
    headingTextColor: { type: String, default: "#f1f5f9" },
    linkColor: { type: String, default: "#38bdf8" },
    linkHoverColor: { type: String, default: "#7dd3fc" },
    warningTextColor: { type: String, default: "#fcd34d" },
    errorTextColor: { type: String, default: "#fb7185" },
    fontBody: { type: String, default: "Inter" },
    fontHeading: { type: String, default: "Inter" },
    fontUi: { type: String, default: "Inter" },
    fontLink: { type: String, default: "Inter" },
    fontWarning: { type: String, default: "Inter" },
    fontCode: { type: String, default: "JetBrains Mono" }
  },
  { timestamps: true }
);

export type ThemeSettingsDocument = InferSchemaType<typeof themeSettingsSchema>;

export const ThemeSettingsModel = mongoose.model("ThemeSettings", themeSettingsSchema);
