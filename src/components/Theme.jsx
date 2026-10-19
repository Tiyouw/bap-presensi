import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("bap.theme");
      return ["light", "dark"].includes(saved) ? saved : "system";
    } catch {
      return "system";
    }
  });

  useEffect(() => {
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("bap.theme", theme);
    } catch {
      /* preference is optional */
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateColor = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", dark ? "#151717" : "#ffffff");
    };
    updateColor();
    media.addEventListener("change", updateColor);
    return () => media.removeEventListener("change", updateColor);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemeSelect() {
  const { theme, setTheme } = useContext(ThemeContext);
  return (
    <label className="theme-select">
      <span className="sr-only">Tema tampilan</span>
      <select value={theme} onChange={(event) => setTheme(event.target.value)}>
        <option value="system">Sistem</option>
        <option value="light">Terang</option>
        <option value="dark">Gelap</option>
      </select>
    </label>
  );
}
