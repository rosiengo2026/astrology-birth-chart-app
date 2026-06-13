"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { bi } from "@/lib/bilingual";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export default function AdminSetupPage() {
  const [licenseKey, setLicenseKey] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [dbReady, setDbReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${API_URL}/auth/setup-status`);
        const data = (await response.json().catch(() => null)) as { databaseReady?: boolean } | null;
        if (cancelled) return;
        if (data && typeof data.databaseReady === "boolean") {
          setDbReady(data.databaseReady);
        } else {
          setDbReady(null);
        }
      } catch {
        if (!cancelled) setDbReady(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: licenseKey.trim(),
          email: email.trim(),
          password
        })
      });
      const data = (await response.json().catch(() => null)) as { token?: string; error?: unknown; message?: string } | null;
      if (!response.ok) {
        if (response.status === 503) {
          setMessage(
            bi(
              "Database unavailable. License activation requires MongoDB.\n\n• Start MongoDB locally or point the API at your cluster.\n• Set MONGO_URI in the API environment (default: mongodb://127.0.0.1:27017/astrology_app).",
              "Chưa kết nối được CSDL. Kích hoạt license cần MongoDB đang chạy.\n\n• Khởi động MongoDB hoặc trỏ API tới cluster.\n• Đặt MONGO_URI trên server API (mặc định: mongodb://127.0.0.1:27017/astrology_app)."
            )
          );
          setDbReady(false);
          return;
        }
        const errText =
          typeof data?.error === "string"
            ? bi(data.error, "Kiểm tra license, email và mật khẩu (tối thiểu 6 ký tự).")
            : typeof data?.error === "object" && data?.error !== null
              ? bi(
                  "Invalid input — check license key, email, and password (min 6 characters).",
                  "Dữ liệu không hợp lệ — kiểm tra license, email và mật khẩu (tối thiểu 6 ký tự)."
                )
              : bi("Setup failed.", "Thiết lập thất bại.");
        setMessage(errText);
        return;
      }
      if (data?.token) {
        localStorage.setItem("adminToken", data.token);
        window.location.href = "/admin";
        return;
      }
      setMessage(
        data?.message ??
          bi("Setup completed but no token was returned.", "Thiết lập xong nhưng không nhận được token.")
      );
    } catch {
      setMessage(bi("Network error. Is the API running?", "Lỗi mạng. API có đang chạy không?"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen mx-auto max-w-md space-y-6 p-6 text-white">
      <div className="rounded-2xl border border-amber-500/35 bg-black/80 p-6 shadow-[0_4px_40px_rgba(0,0,0,0.5)] backdrop-blur-md">
        <h1 className="text-xl font-semibold text-white">{bi("Admin setup", "Thiết lập quản trị")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-amber-200">
          {bi(
            "Use the license key, then choose the email and password for your new admin account. Each license works once.",
            "Dùng mã license, sau đó chọn email và mật khẩu cho tài khoản admin mới. Mỗi license chỉ dùng một lần."
          )}
        </p>
      </div>

      {dbReady === false && (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
        >
          <p className="font-semibold text-amber-50">
            {bi("MongoDB is not connected", "Chưa kết nối MongoDB")}
          </p>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-amber-100/95">
            {bi(
              "License activation is stored in the database. Start MongoDB and ensure the API's ",
              "Kích hoạt license lưu trong CSDL. Hãy chạy MongoDB và đảm bảo "
            )}
            <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-[11px] text-amber-200">MONGO_URI</code>
            {bi(" on the API is correct, then refresh this page.", " trên API đúng, rồi tải lại trang.")}
          </p>
        </div>
      )}

      <form
        className="space-y-4 rounded-xl border border-amber-500/35 bg-black/80 p-4 shadow-[0_4px_40px_rgba(0,0,0,0.5)] backdrop-blur-md"
        onSubmit={onSubmit}
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-amber-100">{bi("License key", "Mã license")}</label>
          <input
            className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white placeholder:text-zinc-500"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            placeholder="ASL-…"
            autoComplete="off"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-amber-100">{bi("Email", "Email")}</label>
          <input
            className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white placeholder:text-zinc-500"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-amber-100">
            {bi("Password (min 6 characters)", "Mật khẩu (tối thiểu 6 ký tự)")}
          </label>
          <input
            className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white placeholder:text-zinc-500"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-amber-600 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:bg-zinc-700"
        >
          {loading
            ? bi("Creating account…", "Đang tạo tài khoản…")
            : bi("Create admin & sign in", "Tạo admin & đăng nhập")}
        </button>
        {message && (
          <p className="whitespace-pre-line rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2 text-sm leading-relaxed text-amber-100">
            {message}
          </p>
        )}
      </form>

      <p className="text-center text-sm text-amber-200">
        {bi("Already have an account?", "Đã có tài khoản?")}{" "}
        <Link href="/admin" className="font-medium text-amber-400 underline hover:text-amber-300">
          {bi("Sign in", "Đăng nhập")}
        </Link>
      </p>
    </main>
  );
}
