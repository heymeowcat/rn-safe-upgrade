"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "rnsa:theme";

export type Theme = "light" | "dark" | "system";

function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const dark = theme === "dark" || (theme === "system" && prefersDark);
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    const next = stored ?? "system";
    setThemeState(next);
    applyTheme(next);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      const active =
        next === "system"
          ? media.matches
          : next === "dark";
      setIsDark(active);
      applyTheme(next);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    setIsDark(
      next === "dark" ||
        (next === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  }, []);

  const toggle = useCallback(() => {
    setTheme(isDark ? "light" : "dark");
  }, [isDark, setTheme]);

  return { theme, setTheme, toggle, isDark };
}
