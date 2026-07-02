import { Languages, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// @ts-expect-error - paraglide generated runtime
import { getLocale, localizeHref } from "@/paraglide/runtime.js";

type LocaleOption = { code: string; label: string; native: string };

const LOCALES: LocaleOption[] = [
  { code: "en", label: "English", native: "English" },
  { code: "fa", label: "Persian", native: "فارسی" },
  { code: "ar", label: "Arabic", native: "العربية" },
  { code: "zh", label: "Chinese", native: "中文" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
];

export function LanguageSwitcher() {
  let current = "en";
  try {
    current = getLocale();
  } catch {
    current = "en";
  }
  const activeNative = LOCALES.find((l) => l.code === current)?.native ?? "English";

  const buildHref = (code: string): string => {
    const path = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
    try {
      return localizeHref(path, { locale: code });
    } catch {
      return `/${code}/`;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Change language"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-2.5 py-2 text-xs text-foreground transition hover:border-magenta/40 sm:px-3"
        >
          <Languages className="h-3.5 w-3.5" />
          <span className="hidden md:inline">{activeNative}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Language</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LOCALES.map((l) => (
          <DropdownMenuItem key={l.code} asChild>
            <a
              href={buildHref(l.code)}
              className="flex items-center justify-between"
              hrefLang={l.code}
            >
              <span>{l.native}</span>
              {l.code === current && <Check className="h-3.5 w-3.5 text-magenta" />}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}