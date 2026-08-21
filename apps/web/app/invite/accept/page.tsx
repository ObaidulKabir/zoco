'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell, loadAccess, storeOrg, useAuthApi } from '../../auth-ui';
import { Button } from '@zoqo/ui';

function AcceptForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { error, busy, send } = useAuthApi();
  const token = params.get('token') ?? params.get('invite') ?? '';

  return (
    <AuthShell title="Accept invitation">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const json = await send('/v1/orgs/invitations/accept', { token }, loadAccess());
          const orgId = json?.data?.membership?.orgId as string | undefined;
          if (orgId) {
            storeOrg(orgId);
            router.push(`/orgs/${orgId}`);
          }
        }}
      >
        {error ? <p role="alert">{error}</p> : null}
        <Button type="submit" disabled={busy || !token}>
          Join organization
        </Button>
      </form>
    </AuthShell>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptForm />
    </Suspense>
  );
}
