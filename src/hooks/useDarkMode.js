// useDarkMode.js — persists dark/light preference to localStorage
// Applies [data-theme="dark"] on <html> for CSS variable switching
import { useState, useEffect } from "react";

export default function useDarkMode() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("fc_dark") === "true"; }
    catch { return false; }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("fc_dark", dark);
  }, [dark]);

  return [dark, () => setDark(d => !d)];
}