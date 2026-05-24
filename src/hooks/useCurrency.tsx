import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type CurrencyCode = "USD" | "KES" | "RWF" | "UGX" | "TZS" | "EUR" | "GBP";

export const CURRENCIES: { code: CurrencyCode; label: string; symbol: string; locale: string }[] = [
  { code: "USD", label: "US Dollar", symbol: "$", locale: "en-US" },
  { code: "KES", label: "Kenyan Shilling", symbol: "KSh", locale: "en-KE" },
  { code: "RWF", label: "Rwandan Franc", symbol: "RF", locale: "rw-RW" },
  { code: "UGX", label: "Ugandan Shilling", symbol: "USh", locale: "en-UG" },
  { code: "TZS", label: "Tanzanian Shilling", symbol: "TSh", locale: "en-TZ" },
  { code: "EUR", label: "Euro", symbol: "€", locale: "en-IE" },
  { code: "GBP", label: "British Pound", symbol: "£", locale: "en-GB" },
];

const KEY = "smarticketing.currency";

interface Ctx {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  format: (amount: number, opts?: { decimals?: number }) => string;
}

const CurrencyContext = createContext<Ctx | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("USD");

  useEffect(() => {
    const stored = (typeof window !== "undefined" && localStorage.getItem(KEY)) as CurrencyCode | null;
    if (stored && CURRENCIES.some((c) => c.code === stored)) setCurrencyState(stored);
  }, []);

  function setCurrency(c: CurrencyCode) {
    setCurrencyState(c);
    try { localStorage.setItem(KEY, c); } catch {}
  }

  function format(amount: number, opts?: { decimals?: number }) {
    const meta = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0];
    const decimals = opts?.decimals ?? (["RWF", "UGX", "TZS", "KES"].includes(currency) ? 0 : 2);
    try {
      return new Intl.NumberFormat(meta.locale, {
        style: "currency",
        currency: meta.code,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amount);
    } catch {
      return `${meta.symbol}${amount.toFixed(decimals)}`;
    }
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, format }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}