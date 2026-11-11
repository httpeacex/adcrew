'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';

export type Theme = 'dark' | 'light';
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'dark', toggle: () => {} });

export function ThemeProvider({ initialTheme, children }: { initialTheme: Theme; children: ReactNode }) {
  const [theme, setTheme] = useState(initialTheme);
  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    document.cookie = `kadr_theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setTheme(next);
  }
  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const { theme, toggle } = useContext(ThemeContext);
  const label = theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему';
  return <button type="button" className="theme-toggle" aria-label={label} title={label} onClick={toggle}>
    {theme === 'dark' ? <Sun size={18} /> : <Moon size={17} />}
  </button>;
}

export function ThemeSelector() {
  const { theme, toggle } = useContext(ThemeContext);
  return <div className="theme-selector" role="group" aria-label="Тема оформления">
    <button type="button" aria-label="Включить светлую тему" aria-pressed={theme === 'light'} onClick={theme === 'dark' ? toggle : undefined}>
      <Sun size={14} aria-hidden="true" /> Светлая
    </button>
    <button type="button" aria-label="Включить тёмную тему" aria-pressed={theme === 'dark'} onClick={theme === 'light' ? toggle : undefined}>
      <Moon size={14} aria-hidden="true" /> Тёмная
    </button>
  </div>;
}
