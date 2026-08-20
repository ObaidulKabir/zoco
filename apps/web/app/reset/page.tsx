'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthShell, Field, useAuthApi } from '../auth-ui';
import { Button } from '@zoqo/ui';

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { error, busy, send } = useAuthApi();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [token, setToken] = useState(params.get('token') ?? '');
  const [password, setPassword] = useState('');

  return (
    <AuthShell title="Reset password">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const json = await send('/v1/auth/reset-password', { email, token, password });
          if (json) router.push('/login');
        }}
      >
        <Field label="Email" type="email" value={email} onChange={setEmail} />
        <Field label="Token" value={token} onChange={setToken} />
        <Field label="New password" type="password" value={password} onChange={setPassword} />
        {error ? <p role="alert">{error}</p> : null}
        <Button type="submit" disabled={busy}>
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}

export default function ResetPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
