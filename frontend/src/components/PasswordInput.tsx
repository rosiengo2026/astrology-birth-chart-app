"use client";

import { useState } from "react";
import { bi } from "@/lib/bilingual";

type PasswordInputProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  autoComplete?: string;
  minLength?: number;
  placeholder?: string;
  required?: boolean;
};

export function PasswordInput({
  value,
  onChange,
  className = "",
  inputClassName = "",
  disabled = false,
  autoComplete = "current-password",
  minLength,
  placeholder,
  required
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <input
        className={`w-full rounded border border-zinc-600 bg-zinc-950 p-2 pr-10 text-white placeholder:text-zinc-500 ${inputClassName}`}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        minLength={minLength}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0 flex items-center px-2.5 text-xs font-medium text-amber-300/90 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={visible ? bi("Hide password", "Ẩn mật khẩu") : bi("Show password", "Hiện mật khẩu")}
      >
        {visible ? bi("Hide", "Ẩn") : bi("Show", "Hiện")}
      </button>
    </div>
  );
}
