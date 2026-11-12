import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { ThemeProvider } from '@/components/theme';

export const metadata: Metadata = {
  title: { default: 'AdCrew — креативный отдел', template: '%s · AdCrew' },
  description: 'Рабочее пространство заказчиков, креативщиков и руководителя.',
  icons: { icon: '/auth-mark.svg' },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = (await cookies()).get('kadr_theme')?.value === 'light' ? 'light' : 'dark';
  return <html lang="ru" data-theme={theme}><body><ThemeProvider initialTheme={theme}>{children}</ThemeProvider></body></html>;
}
