'use client';

import { useState } from 'react';
import { AuthShell, Field, useAuthApi } from '../auth-ui';
import { Button } from '@zoqo/ui';

export default function ForgotPage() {
  const { error, busy, send } = useAuthApi();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState('');

  return (
    <AuthShell title="Forgot password">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const json = await send('/v1/auth/forgot-password', { email });
          if (json?.data?.message) setDone(json.data.message);
        }}
      >
        <Field label="Email" type="email" value={email} onChange={setEmail} />
        {error ? <p role="alert">{error}</p> : null}
        {done ? <p>{done}</p> : null}
        <Button type="submit" disabled={busy}>
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}
