import type { ReactNode } from 'react';

export const metadata = {
  title: 'Zoqo',
  description: 'Unified B2B communication',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          margin: 40,
          color: '#0f172a',
          background: '#f8fafc',
        }}
      >
        {children}
      </body>
    </html>
  );
}

