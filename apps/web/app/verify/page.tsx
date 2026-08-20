'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthShell, Field, storeTokens, useAuthApi } from '../auth-ui';
import { Button } from '@zoqo/ui';

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { error, busy, send } = useAuthApi();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [otp, setOtp] = useState('');

  return (
    <AuthShell title="Verify email">
      <p>Enter the 6-digit code from Mailpit (http://localhost:8025).</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const json = await send('/v1/auth/verify-email', { email, otp });
          if (json?.data) {
            storeTokens(json.data);
            router.push('/sessions');
          }
        }}
      >
        <Field label="Email" type="email" value={email} onChange={setEmail} />
        <Field label="OTP" value={otp} onChange={setOtp} />
        {error ? <p role="alert">{error}</p> : null}
        <Button type="submit" disabled={busy}>
          Verify
        </Button>
      </form>
    </AuthShell>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
