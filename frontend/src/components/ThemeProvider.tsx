'use client';

import React, { createContext, useContext, useEffect, useState, useTransition } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'driveflow_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark');
  const [mounted, setMounted] = useState(false);
  const [, startTransition] = useTransition();

  // Helper to determine resolved theme from system
  const getSystemTheme = (): ResolvedTheme => {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const applyThemeToDOM = (resolved: ResolvedTheme) => {
    const root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }

    // Update meta theme-color for mobile status bar
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', resolved === 'dark' ? '#080711' : '#f8fafc');
    }
  };

  // Initialize theme on mount
  useEffect(() => {
    const savedTheme = (localStorage.getItem(THEME_STORAGE_KEY) as Theme) || 'dark';
    setThemeState(savedTheme);

    const initialResolved: ResolvedTheme =
      savedTheme === 'system' ? getSystemTheme() : savedTheme === 'light' ? 'light' : 'dark';

    setResolvedTheme(initialResolved);
    applyThemeToDOM(initialResolved);
    setMounted(true);

    // System theme change listener
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const currentStored = localStorage.getItem(THEME_STORAGE_KEY);
      if (currentStored === 'system') {
        const newResolved = e.matches ? 'dark' : 'light';
        setResolvedTheme(newResolved);
        applyThemeToDOM(newResolved);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (e) {
      console.warn('Unable to persist theme to localStorage', e);
    }

    const newResolved: ResolvedTheme =
      newTheme === 'system' ? getSystemTheme() : newTheme === 'light' ? 'light' : 'dark';

    startTransition(() => {
      setResolvedTheme(newResolved);
      applyThemeToDOM(newResolved);
    });
  };

  const toggleTheme = () => {
    const nextTheme: Theme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
