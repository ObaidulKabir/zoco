'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { AuthShell, Field, loadAccess, storeOrg, useAuthApi } from '../../../auth-ui';
import { Button } from '@zoqo/ui';

export default function InvitePage() {
  // See the note in app/orgs/[orgId]/page.tsx on why this is a hook.
  const { orgId } = useParams<{ orgId: string }>();
  const { error, busy, send } = useAuthApi();
  const [emails, setEmails] = useState('');
  const [done, setDone] = useState('');
  storeOrg(orgId);

  return (
    <AuthShell title="Invite members">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const json = await send(
            `/v1/orgs/${orgId}/invite`,
            { emails: emails.split(/[,\s]+/).filter(Boolean), role: 'member' },
            loadAccess(),
          );
          if (json) setDone(`Invited ${(json.data?.invitations as unknown[] | undefined)?.length ?? 0} people`);
        }}
      >
        <Field label="Emails" value={emails} onChange={setEmails} />
        {error ? <p role="alert">{error}</p> : null}
        {done ? <p>{done}</p> : null}
        <Button type="submit" disabled={busy}>
          Send invites
        </Button>
      </form>
    </AuthShell>
  );
}
