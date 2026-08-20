'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthShell, Field, useAuthApi } from '../auth-ui';
import { Button } from '@zoqo/ui';

export default function RegisterPage() {
  const router = useRouter();
  const { error, busy, send } = useAuthApi();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <AuthShell title="Create account">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const json = await send('/v1/auth/register', { name, email, password });
          if (json) router.push(`/verify?email=${encodeURIComponent(email)}`);
        }}
      >
        <Field label="Full name" value={name} onChange={setName} autoComplete="name" />
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        {error ? <p role="alert">{error}</p> : null}
        <Button type="submit" disabled={busy}>
          Register
        </Button>
      </form>
    </AuthShell>
  );
}
