'use client';

import { useEffect, useState } from 'react';
import { AuthShell, loadAccess, useAuthApi } from '../auth-ui';
import { Button } from '@zoqo/ui';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type SessionRow = {
  id: string;
  device: string;
  ip: string;
  location: string;
  lastActiveAt: string;
  current: boolean;
};

export default function SessionsPage() {
  const { error, setError } = useAuthApi();
  const [rows, setRows] = useState<SessionRow[]>([]);

  const refresh = async () => {
    const res = await fetch(`${apiBase}/v1/auth/sessions`, {
      headers: { authorization: `Bearer ${loadAccess()}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error?.message ?? 'Not signed in');
      setRows([]);
      return;
    }
    setRows(json.data ?? []);
  };

  useEffect(() => {
    void refresh();
    // Load once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthShell title="Sessions">
      {error ? <p role="alert">{error}</p> : null}
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            {row.device} · {row.ip} · {row.current ? 'this device' : row.lastActiveAt}
            <Button
              onClick={async () => {
                await fetch(`${apiBase}/v1/auth/sessions/${row.id}`, {
                  method: 'DELETE',
                  headers: { authorization: `Bearer ${loadAccess()}` },
                });
                await refresh();
              }}
            >
              Revoke
            </Button>
          </li>
        ))}
      </ul>
      <Button
        onClick={async () => {
          await fetch(`${apiBase}/v1/auth/logout-all`, {
            method: 'POST',
            headers: { authorization: `Bearer ${loadAccess()}` },
          });
          sessionStorage.clear();
          await refresh();
        }}
      >
        Log out all devices
      </Button>
    </AuthShell>
  );
}
