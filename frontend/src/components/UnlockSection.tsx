"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import { bi } from "@/lib/bilingual";
import {
  clearAspectAccessToken,
  getAspectAccessToken,
  setAspectAccessToken,
  verifyAspectAccessToken
} from "@/lib/aspectAccess";
import { PayPalHostedButton } from "@/components/PayPalHostedButton";
import { resolveThemeAssetUrl } from "@/lib/siteTheme";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

interface UnlockSectionProps {
  children: ReactNode;
  preview: ReactNode;
  buttonLabel?: string;
  /** Skip payment gate and show full content (admin storefront preview). */
  forceUnlocked?: boolean;
}

type AspectPaymentOptions = {
  vietqr: {
    transferPrefix: string;
    amount: number;
    currency: string;
    qrImageUrl: string;
    instructionsVi: string;
    instructionsEn: string;
    sessionTtlMinutes: number;
    webhookConfigured?: boolean;
  };
  paypal: {
    amount: number;
    currency: string;
    redirectUrl: string;
    startUrl: string;
    callbackUrl: string;
    qrImageUrl: string;
    clientId: string;
    hostedButtonId: string;
  };
};

type VietQrSession = {
  sessionId: string;
  transferContent: string;
  amount: number;
  currency: string;
  expiresAt: string;
  qrImageUrl: string;
  instructionsVi: string;
  instructionsEn: string;
};

function buildPaypalCheckoutUrl(): string {
  const base = API_URL.replace(/\/?$/, "");
  return `${base}/payments/aspect/paypal/start`;
}

function WebhookFallbackNotice() {
  return (
    <p className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs leading-relaxed text-[var(--theme-warning)] font-[family:var(--font-theme-warning)]">
      {bi(
        "If this page does not unlock automatically after your transfer, please email ",
        "Nếu trang không tự mở khóa sau khi chuyển khoản, vui lòng liên hệ admin qua email "
      )}
      <a
        href="mailto:wakagemstone@gmail.com"
        className="font-semibold text-amber-100 underline hover:text-white"
      >
        wakagemstone@gmail.com
      </a>
      {bi(
        " with your transfer memo to receive the full aspect interpretations.",
        " kèm nội dung chuyển khoản để nhận lời giải aspect đầy đủ."
      )}
    </p>
  );
}

export function UnlockSection({
  children,
  preview,
  buttonLabel = bi("Unlock full aspects", "Mở khóa đầy đủ aspect"),
  forceUnlocked = false
}: UnlockSectionProps) {
  const [isPaid, setIsPaid] = useState(false);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [paymentModal, setPaymentModal] = useState<null | "vietqr" | "paypal">(null);
  const [paymentOptions, setPaymentOptions] = useState<AspectPaymentOptions | null>(null);
  const [paymentOptionsLoading, setPaymentOptionsLoading] = useState(false);
  const [paymentOptionsError, setPaymentOptionsError] = useState<string | null>(null);
  const [vietQrSession, setVietQrSession] = useState<VietQrSession | null>(null);
  const [vietQrSessionLoading, setVietQrSessionLoading] = useState(false);
  const [vietQrSessionError, setVietQrSessionError] = useState<string | null>(null);
  const [vietQrWaiting, setVietQrWaiting] = useState(false);

  const applyAccessToken = useCallback((token: string) => {
    setAspectAccessToken(token);
    setIsPaid(true);
    setPaymentModal(null);
    setVietQrWaiting(false);
  }, []);

  const refreshUnlockState = useCallback(async () => {
    const token = getAspectAccessToken();
    if (!token) {
      setIsPaid(false);
      return;
    }
    const valid = await verifyAspectAccessToken(API_URL, token);
    if (valid) {
      setIsPaid(true);
      return;
    }
    clearAspectAccessToken();
    setIsPaid(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const tokenFromUrl = url.searchParams.get("aspectAccessToken");
    if (tokenFromUrl) {
      applyAccessToken(tokenFromUrl);
      url.searchParams.delete("aspectAccessToken");
      url.searchParams.delete("paypal");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      return;
    }
    void refreshUnlockState();
  }, [applyAccessToken, refreshUnlockState]);

  useEffect(() => {
    const onChanged = () => {
      void refreshUnlockState();
    };
    window.addEventListener("aspect-access-changed", onChanged);
    return () => window.removeEventListener("aspect-access-changed", onChanged);
  }, [refreshUnlockState]);

  useEffect(() => {
    if (forceUnlocked || isPaid) return;
    let cancelled = false;
    setPaymentOptionsLoading(true);
    setPaymentOptionsError(null);
    (async () => {
      try {
        const response = await fetch(`${API_URL}/payments/aspect/options`);
        if (!response.ok) throw new Error(bi("Could not load payment options.", "Không tải được cấu hình thanh toán."));
        const data = (await response.json()) as AspectPaymentOptions;
        if (!cancelled) setPaymentOptions(data);
      } catch {
        if (!cancelled) {
          setPaymentOptionsError(
            bi("Could not load payment settings. Check the API/backend.", "Không tải được cấu hình thanh toán. Kiểm tra backend.")
          );
          setPaymentOptions(null);
        }
      } finally {
        if (!cancelled) setPaymentOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [forceUnlocked, isPaid]);

  const startVietQrSession = useCallback(async () => {
    setVietQrSessionLoading(true);
    setVietQrSessionError(null);
    try {
      const response = await fetch(`${API_URL}/payments/aspect/vietqr/session`, { method: "POST" });
      if (!response.ok) {
        throw new Error(bi("Could not start VietQR payment session.", "Không tạo được phiên thanh toán VietQR."));
      }
      const data = (await response.json()) as VietQrSession;
      setVietQrSession(data);
      setVietQrWaiting(true);
    } catch (error) {
      setVietQrSession(null);
      setVietQrWaiting(false);
      setVietQrSessionError(
        error instanceof Error
          ? error.message
          : bi("Could not start VietQR payment session.", "Không tạo được phiên thanh toán VietQR.")
      );
    } finally {
      setVietQrSessionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (paymentModal !== "vietqr") {
      setVietQrSession(null);
      setVietQrWaiting(false);
      setVietQrSessionError(null);
      return;
    }
    void startVietQrSession();
  }, [paymentModal, startVietQrSession]);

  useEffect(() => {
    if (!vietQrWaiting || !vietQrSession?.sessionId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(
          `${API_URL}/payments/aspect/vietqr/status?sessionId=${encodeURIComponent(vietQrSession.sessionId)}`
        );
        if (!response.ok) return;
        const data = (await response.json()) as { status?: string; accessToken?: string | null };
        if (cancelled) return;
        if (data.status === "paid" && data.accessToken) {
          applyAccessToken(data.accessToken);
        }
        if (data.status === "expired") {
          setVietQrWaiting(false);
          setVietQrSessionError(
            bi("Payment session expired. Close and open VietQR again.", "Phiên thanh toán đã hết hạn. Đóng và mở lại VietQR.")
          );
        }
      } catch {
        // keep polling
      }
    };
    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [applyAccessToken, vietQrSession, vietQrWaiting]);

  const openPaypalCheckout = useCallback(() => {
    const redirectUrl = paymentOptions?.paypal.redirectUrl?.trim() || buildPaypalCheckoutUrl();
    window.location.href = redirectUrl;
  }, [paymentOptions?.paypal.redirectUrl]);

  const activeQrImageUrl = vietQrSession?.qrImageUrl || paymentOptions?.vietqr.qrImageUrl || "";
  const activeTransferContent = vietQrSession?.transferContent ?? "";
  const activeAmount = vietQrSession?.amount ?? paymentOptions?.vietqr.amount ?? 0;
  const activeCurrency = vietQrSession?.currency ?? paymentOptions?.vietqr.currency ?? "VND";
  const activeInstructionsVi = vietQrSession?.instructionsVi || paymentOptions?.vietqr.instructionsVi || "";
  const activeInstructionsEn = vietQrSession?.instructionsEn || paymentOptions?.vietqr.instructionsEn || "";

  if (forceUnlocked) {
    return <>{children}</>;
  }

  if (isPaid) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-200 font-[family:var(--font-theme-ui)]">
            🔓 {bi("Unlocked", "Đã mở khóa")}
          </span>
          <button
            type="button"
            className="rounded border border-[var(--theme-border)] px-2 py-1 text-xs text-[var(--theme-body)] font-[family:var(--font-theme-ui)] hover:bg-[var(--theme-panel)]"
            onClick={() => {
              clearAspectAccessToken();
              setIsPaid(false);
            }}
          >
            {bi("Lock again", "Khóa lại")}
          </button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <span className="inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-[var(--theme-warning)] font-[family:var(--font-theme-warning)]">
        🔒 {bi("Locked", "Đang khóa")}
      </span>
      <div className="pointer-events-none select-none blur-[2px]">{preview}</div>
      <button
        type="button"
        onClick={() => setShowPaymentOptions((current) => !current)}
        className="rounded-lg bg-[#0070ba] px-4 py-2 text-sm font-semibold text-white hover:bg-[#005ea6]"
      >
        {buttonLabel}
      </button>
      {paymentOptions?.vietqr.webhookConfigured === false && <WebhookFallbackNotice />}
      {showPaymentOptions && (
        <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-panel)] p-3">
          <p className="text-xs font-semibold text-[var(--theme-heading)] font-[family:var(--font-theme-heading)]">
            {bi("Choose payment method", "Chọn phương thức thanh toán")}
          </p>
          {paymentOptionsLoading && (
            <p className="mt-2 text-[11px] text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
              {bi("Loading payment settings…", "Đang tải cấu hình…")}
            </p>
          )}
          {paymentOptionsError && (
            <p className="mt-2 text-[11px] text-[var(--theme-error)] font-[family:var(--font-theme-warning)]">
              {paymentOptionsError}
            </p>
          )}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-left text-xs text-emerald-200 hover:bg-emerald-500/20"
              onClick={() => setPaymentModal("vietqr")}
            >
              🇻🇳 {bi("VietQR (Vietnam)", "VietQR (Việt Nam)")}
              <div className="mt-1 text-[11px] text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                {bi("Scan QR and transfer with your unique memo", "Quét QR và chuyển khoản với nội dung riêng của bạn")}
              </div>
            </button>
            <button
              type="button"
              className="rounded border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-left text-xs text-sky-200 hover:bg-sky-500/20"
              onClick={() => setPaymentModal("paypal")}
            >
              🌍 {bi("PayPal (global)", "PayPal (quốc tế)")}
              <div className="mt-1 text-[11px] text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                {bi("Scan PayPal QR or open checkout", "Quét QR PayPal hoặc mở trang thanh toán")}
              </div>
            </button>
          </div>
        </div>
      )}

      {paymentModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-modal-title"
          onClick={() => setPaymentModal(null)}
        >
          <div
            className="max-h-[min(90vh,32rem)] w-full max-w-md overflow-y-auto rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)] p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h2
                id="payment-modal-title"
                className="text-base font-semibold text-[var(--theme-heading)] font-[family:var(--font-theme-heading)]"
              >
                {paymentModal === "vietqr"
                  ? bi("VietQR payment", "Thanh toán VietQR")
                  : bi("PayPal payment", "Thanh toán PayPal")}
              </h2>
              <button
                type="button"
                className="shrink-0 rounded-md border border-[var(--theme-border)] px-2 py-1 text-xs text-[var(--theme-body)] hover:bg-[var(--theme-bg)]"
                onClick={() => setPaymentModal(null)}
              >
                {bi("Close", "Đóng")}
              </button>
            </div>

            {paymentModal === "vietqr" && (
              <div className="mt-4 space-y-3 text-sm text-[var(--theme-body)] font-[family:var(--font-theme-body)]">
                {vietQrSessionLoading && (
                  <p className="text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                    {bi("Preparing payment session…", "Đang tạo phiên thanh toán…")}
                  </p>
                )}
                {vietQrSessionError && (
                  <p className="rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-[var(--theme-error)]">
                    {vietQrSessionError}
                  </p>
                )}
                {activeQrImageUrl ? (
                  <div className="flex justify-center rounded-lg border border-[var(--theme-border)] bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveThemeAssetUrl(activeQrImageUrl)}
                      alt={bi("VietQR code", "Mã VietQR")}
                      className="max-h-64 max-w-full object-contain"
                    />
                  </div>
                ) : (
                  !vietQrSessionLoading && (
                    <p className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-[var(--theme-warning)] font-[family:var(--font-theme-warning)]">
                      {bi(
                        "No QR image yet. Add a QR image URL in Admin → Payment.",
                        "Chưa có ảnh QR. Thêm URL ảnh tại Admin → Payment."
                      )}
                    </p>
                  )
                )}
                {activeTransferContent && (
                  <div className="space-y-1 rounded border border-[var(--theme-border)] bg-[var(--theme-bg)]/90 p-2 text-xs">
                    <p>
                      <span className="text-[var(--theme-muted)]">{bi("Amount:", "Số tiền:")}</span>{" "}
                      <span className="font-semibold text-[var(--theme-heading)]">
                        {activeAmount.toLocaleString()} {activeCurrency}
                      </span>
                    </p>
                    <p>
                      <span className="text-[var(--theme-muted)]">{bi("Transfer memo:", "Nội dung CK:")}</span>{" "}
                      <span className="font-[family:var(--font-theme-code)] text-emerald-200">{activeTransferContent}</span>
                    </p>
                    <p className="text-[11px] text-amber-200/90">
                      {bi(
                        "Use this exact transfer memo so the system can verify your payment.",
                        "Nhập đúng nội dung chuyển khoản này để hệ thống xác nhận thanh toán."
                      )}
                    </p>
                  </div>
                )}
                {vietQrWaiting && (
                  <p className="rounded border border-sky-500/30 bg-sky-500/10 p-2 text-xs text-sky-100">
                    {bi(
                      "Waiting for bank confirmation… This page will unlock automatically after your transfer is received.",
                      "Đang chờ ngân hàng xác nhận… Trang sẽ tự mở khóa sau khi nhận được chuyển khoản."
                    )}
                  </p>
                )}
                {activeInstructionsVi ? (
                  <div>
                    <p className="text-xs font-semibold text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                      {bi("Instructions (Vietnamese)", "Hướng dẫn (Tiếng Việt)")}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-xs leading-relaxed">{activeInstructionsVi}</p>
                  </div>
                ) : null}
                {activeInstructionsEn ? (
                  <div>
                    <p className="text-xs font-semibold text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                      {bi("Instructions (English)", "Hướng dẫn (Tiếng Anh)")}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-xs leading-relaxed">{activeInstructionsEn}</p>
                  </div>
                ) : null}
              </div>
            )}

            {paymentModal === "paypal" && (
              <div className="mt-4 space-y-3 text-sm text-[var(--theme-body)] font-[family:var(--font-theme-body)]">
                {paymentOptions?.paypal.qrImageUrl ? (
                  <div className="flex justify-center rounded-lg border border-[var(--theme-border)] bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveThemeAssetUrl(paymentOptions.paypal.qrImageUrl)}
                      alt={bi("PayPal QR code", "Mã QR PayPal")}
                      className="max-h-64 max-w-full object-contain"
                    />
                  </div>
                ) : null}
                <p className="text-xs leading-relaxed text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                  {bi(
                    "Use the PayPal button below or open the checkout page. After payment, configure your PayPal button return URL to this site to unlock automatically.",
                    "Dùng nút PayPal bên dưới hoặc mở trang thanh toán. Sau khi thanh toán, cấu hình Return URL của nút PayPal trỏ về site này để tự mở khóa."
                  )}
                </p>
                {paymentOptions && (
                  <p className="text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                    {bi("Reference amount:", "Số tiền tham khảo:")}{" "}
                    <span className="font-semibold text-[var(--theme-heading)]">
                      {paymentOptions.paypal.amount} {paymentOptions.paypal.currency}
                    </span>
                  </p>
                )}
                {paymentOptions?.paypal.clientId && paymentOptions.paypal.hostedButtonId ? (
                  <div className="rounded-lg border border-[var(--theme-border)] bg-white p-3">
                    <PayPalHostedButton
                      clientId={paymentOptions.paypal.clientId}
                      hostedButtonId={paymentOptions.paypal.hostedButtonId}
                      currency={paymentOptions.paypal.currency}
                    />
                  </div>
                ) : null}
                <button
                  type="button"
                  className="w-full rounded-lg bg-[#0070ba] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#005ea6]"
                  onClick={openPaypalCheckout}
                >
                  {bi("Open PayPal checkout", "Mở trang thanh toán PayPal")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
