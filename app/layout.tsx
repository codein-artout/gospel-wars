import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource/grenze-gotisch/500.css';
import '@fontsource/grenze-gotisch/700.css';
import '@fontsource/grenze-gotisch/800.css';
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/500.css';
import '@fontsource/instrument-sans/600.css';
import '@fontsource/instrument-sans/700.css';
import '@fontsource/spectral/400.css';
import '@fontsource/spectral/400-italic.css';
import '@fontsource/spectral/600.css';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.AUTH_URL ?? 'http://localhost:3000'),
  title: { default: 'Gospel Wars', template: '%s | Gospel Wars' },
  description: 'Write a gospel for an invented faith. A house apostle preaches it to a world of 48 AI agents.',
};

export const viewport: Viewport = {
  themeColor: '#191430',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
