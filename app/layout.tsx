import type { Metadata } from 'next';
import './globals.css';
import { Inter, Playfair_Display } from 'next/font/google';
import NavBar from '@/components/NavBar';
import ToastRoot from '@/components/ToastRoot';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'Restaurant Order Discovery',
  description: 'See what diners are ordering right now, browse the menu, and track trending dishes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body>
        <ToastRoot>
          <div className="app-shell">
            <NavBar />
            <main className="app-main">{children}</main>
          </div>
        </ToastRoot>
      </body>
    </html>
  );
}
