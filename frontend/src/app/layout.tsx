import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteThemeProvider } from "@/components/SiteThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Natal chart · Lá số tử vi",
  description:
    "Generate a modern natal chart in seconds. · Tạo lá số tử vi hiện đại trong vài giây.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-[family:var(--font-theme-body)] text-[var(--theme-body)] antialiased">
        <SiteThemeProvider>
          {children}
          <footer className="mt-auto border-t border-[var(--theme-border)]/50 bg-black/20 px-4 py-3 text-center text-xs text-[var(--theme-muted)]">
            {`Phần mềm này thuộc bản quyền của `}
            <a
              href="mailto:rosie.hn.ngo@gmail.com"
              className="font-medium text-[var(--theme-link)] underline hover:text-[var(--theme-link-hover)]"
            >
              Rosie Ngô
            </a>
            {` 2026 · This software is copyrighted by `}
            <a
              href="mailto:rosie.hn.ngo@gmail.com"
              className="font-medium text-[var(--theme-link)] underline hover:text-[var(--theme-link-hover)]"
            >
              Rosie Ngô
            </a>
            {` 2026`}
          </footer>
        </SiteThemeProvider>
      </body>
    </html>
  );
}
