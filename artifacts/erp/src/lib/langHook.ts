import { useState, useEffect } from "react";
import { getLang, type Lang } from "./lang";

export function useLang(): Lang {
  const [lang, setLangState] = useState<Lang>(getLang());
  useEffect(() => {
    const handler = () => setLangState(getLang());
    window.addEventListener("lang-change", handler);
    return () => window.removeEventListener("lang-change", handler);
  }, []);
  return lang;
}
