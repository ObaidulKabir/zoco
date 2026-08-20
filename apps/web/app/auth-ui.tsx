'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@zoqo/ui';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Props = {
  title: string;
  children: React.ReactNode;
};

export function AuthShell({ title, children }: Props) {
  return (
    <main style={{ maxWidth: 420 }}>
      <p>
        <Link href="/">Zoqo</Link>
      </p>
      <h1>{title}</h1>
      {children}
    </main>
  );
}

export function Field({
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div>{label}</div>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', padding: 8 }}
      />
    </label>
  );
}

export function useAuthApi() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (path: string, body: unknown, token?: string) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error?.message ?? `Request failed (${res.status})`);
        return null;
      }
      return json;
    } finally {
      setBusy(false);
    }
  };

  return { error, busy, send, setError, Button };
}

export const storeTokens = (data: { accessToken?: string; refreshToken?: string }) => {
  if (data.accessToken) sessionStorage.setItem('zoqo.access', data.accessToken);
  if (data.refreshToken) sessionStorage.setItem('zoqo.refresh', data.refreshToken);
};

export const loadAccess = (): string =>
  typeof window === 'undefined' ? '' : sessionStorage.getItem('zoqo.access') ?? '';
