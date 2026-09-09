import { useState } from "react";

/** Presentation density only; never an authorization or capability switch. */
export type ProductComplexityMode = "simple" | "advanced";

export function useProductComplexityMode(initialMode: ProductComplexityMode = "simple") {
  const [mode, setMode] = useState<ProductComplexityMode>(initialMode);
  return { mode, setMode };
}
