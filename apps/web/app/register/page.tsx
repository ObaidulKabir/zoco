'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthShell, Field, useAuthApi } from '../auth-ui';
import { Button } from '@zoqo/ui';

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const inviteToken = params.get('invite') ?? '';
  const { error, busy, send } = useAuthApi();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <AuthShell title="Create account">
      {inviteToken ? <p>You were invited. Your code will appear on the next step.</p> : null}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const json = await send('/v1/auth/register', {
            name,
            email,
            password,
            ...(inviteToken ? { inviteToken } : {}),
          });
          if (json) {
            const code = json.data?.verificationCode as string | undefined;
            const q = new URLSearchParams({ email });
            if (code) q.set('otp', code);
            if (inviteToken) q.set('invite', inviteToken);
            router.push(`/verify?${q.toString()}`);
          }
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

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
