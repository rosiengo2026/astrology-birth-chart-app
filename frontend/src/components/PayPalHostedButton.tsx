"use client";

import { useEffect, useId, useRef } from "react";

type PayPalHostedButtonProps = {
  clientId: string;
  hostedButtonId: string;
  currency?: string;
};

declare global {
  interface Window {
    paypal?: {
      HostedButtons: (config: { hostedButtonId: string }) => {
        render: (selector: string) => Promise<void>;
      };
    };
  }
}

const SCRIPT_ID = "paypal-hosted-buttons-sdk";

function loadPayPalSdk(clientId: string, currency: string): Promise<void> {
  if (window.paypal?.HostedButtons) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("PayPal SDK failed to load")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&components=hosted-buttons&disable-funding=venmo&currency=${encodeURIComponent(currency)}`;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error("PayPal SDK failed to load"));
    document.body.appendChild(script);
  });
}

export function PayPalHostedButton({ clientId, hostedButtonId, currency = "AUD" }: PayPalHostedButtonProps) {
  const reactId = useId();
  const containerId = `paypal-container-${hostedButtonId}-${reactId.replace(/:/g, "")}`;
  const rendered = useRef(false);

  useEffect(() => {
    if (!clientId || !hostedButtonId || rendered.current) return;
    let cancelled = false;
    (async () => {
      await loadPayPalSdk(clientId, currency);
      if (cancelled || !window.paypal?.HostedButtons) return;
      await window.paypal.HostedButtons({ hostedButtonId }).render(`#${containerId}`);
      rendered.current = true;
    })().catch(() => {
      rendered.current = false;
    });
    return () => {
      cancelled = true;
    };
  }, [clientId, hostedButtonId, currency, containerId]);

  return <div id={containerId} className="min-h-[3rem] w-full" />;
}
