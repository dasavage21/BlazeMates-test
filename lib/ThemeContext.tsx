// app/theme/ThemeContext.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance } from "react-native";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => Promise<void>;
  setTheme: (next: Theme) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  isDark: true,
  toggleTheme: async () => {},
  setTheme: async () => {},
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    void (async () => {
      try {
        const storedTheme = await AsyncStorage.getItem("theme");
        if (storedTheme === "light" || storedTheme === "dark") {
          setThemeState(storedTheme);
          return;
        }

        const systemTheme = Appearance.getColorScheme();
        if (systemTheme === "light") {
          setThemeState("light");
        }
      } catch (error) {
        console.warn("Failed to load stored theme", error);
      }
    })();
  }, []);

  const applyTheme = useCallback(async (nextTheme: Theme) => {
    setThemeState(nextTheme);
    try {
      await AsyncStorage.setItem("theme", nextTheme);
    } catch (error) {
      console.warn("Failed to persist theme", error);
    }
  }, []);

  const toggleTheme = useCallback(async () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    await applyTheme(nextTheme);
  }, [applyTheme, theme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      toggleTheme,
      setTheme: applyTheme,
    }),
    [applyTheme, theme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
