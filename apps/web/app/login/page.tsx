'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthShell, Field, storeTokens, useAuthApi } from '../auth-ui';
import { Button } from '@zoqo/ui';

export default function LoginPage() {
  const router = useRouter();
  const { error, busy, send } = useAuthApi();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <AuthShell title="Sign in">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const json = await send('/v1/auth/login', { email, password });
          if (json?.data) {
            storeTokens(json.data);
            router.push('/orgs');
          }
        }}
      >
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        {error ? <p role="alert">{error}</p> : null}
        <Button type="submit" disabled={busy}>
          Login
        </Button>
      </form>
      <p>
        <a href="/forgot">Forgot password</a>
      </p>
    </AuthShell>
  );
}
