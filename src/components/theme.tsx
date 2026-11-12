'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Monitor, Moon, Sun } from 'lucide-react';
export type Theme = 'dark' | 'light';
type Preference = Theme | 'auto';
const ThemeContext = createContext<{theme: Theme; preference: Preference; choose: (value: Preference) => void; toggle: () => void}>({theme:'dark',preference:'dark',choose:()=>{},toggle:()=>{}});
export function ThemeProvider({initialTheme, children}: {initialTheme: Theme; children: ReactNode}) {
  const [theme, setTheme] = useState(initialTheme);
  const [preference, setPreference] = useState<Preference>(initialTheme);
  function apply(value: Theme) {
    document.documentElement.dataset.theme = value;
    document.cookie = `kadr_theme=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setTheme(value);
  }
  function choose(value: Preference) {
    setPreference(value);
    try { localStorage.setItem('adcrew-theme', value); } catch { /* Theme still works without storage. */ }
    const next = value === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : value;
    if (next !== theme && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.startViewTransition(() => flushSync(() => apply(next)));
    } else {
      apply(next);
    }
  }
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem('adcrew-theme'); } catch { /* Optional preference. */ }
    if (saved === 'auto' || saved === 'light' || saved === 'dark') {
      // Restore the browser preference after server hydration.
      /* eslint-disable react-hooks/set-state-in-effect */
      setPreference(saved);
      apply(saved === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : saved);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, []);
  useEffect(() => {
    if (preference !== 'auto') return;
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () => apply(media.matches ? 'dark' : 'light');
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [preference]);
  return <ThemeContext.Provider value={{theme,preference,choose,toggle:()=>choose(theme === 'dark' ? 'light' : 'dark')}}>{children}</ThemeContext.Provider>;
}
export function ThemeToggle() {
  const {theme,toggle} = useContext(ThemeContext);
  const label = theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему';
  return <button type="button" className="theme-toggle" aria-label={label} title={label} onClick={toggle}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={17}/>}</button>;
}
export function ThemeSelector() {
  const {preference,choose} = useContext(ThemeContext);
  return <div className="theme-selector" role="group" aria-label="Тема оформления">{([['light','Светлая','Включить светлую тему',Sun],['dark','Тёмная','Включить тёмную тему',Moon],['auto','Авто','Использовать системную тему',Monitor]] as const).map(([value,label,aria,Icon]) => <button type="button" key={value} aria-label={aria} title={aria} aria-pressed={preference === value} onClick={()=>choose(value)}><Icon size={13}/><span>{label}</span></button>)}</div>;
}
