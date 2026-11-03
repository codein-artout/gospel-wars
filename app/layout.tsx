import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Gospel Wars', template: '%s | Gospel Wars' },
  description: 'Write a gospel for an invented faith. An apostle preaches it to 48 AI agents.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
