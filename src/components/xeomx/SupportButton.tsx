import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import { SupportDrawer } from "./SupportDrawer";

export function SupportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Support"
        onClick={() => setOpen(true)}
        className="group fixed z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rtl:right-auto rtl:left-4 md:h-12 md:w-auto md:gap-2 md:px-5"
        style={{
          bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
          right: "calc(1rem + env(safe-area-inset-right, 0px))",
          background: "var(--gradient-magenta)",
          boxShadow: "var(--shadow-glow)",
        }}
      >
        <LifeBuoy className="h-5 w-5" />
        <span className="hidden text-sm font-medium md:inline">Support</span>
      </button>
      <SupportDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
