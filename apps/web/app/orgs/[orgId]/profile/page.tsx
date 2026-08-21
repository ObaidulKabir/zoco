'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthShell, Field, loadAccess, storeOrg, useAuthApi } from '../../../auth-ui';
import { Button } from '@zoqo/ui';

export default function ProfilePage() {
  // See the note in app/orgs/[orgId]/page.tsx on why this is a hook.
  const { orgId } = useParams<{ orgId: string }>();
  const { error, busy, send } = useAuthApi();
  const [title, setTitle] = useState('');
  const [presence, setPresence] = useState('online');
  storeOrg(orgId);

  useEffect(() => {
    void (async () => {
      const json = await send(`/v1/orgs/${orgId}/profile`, undefined, loadAccess(), 'GET');
      if (json?.data) {
        setTitle((json.data.title as string) ?? '');
        setPresence((json.data.presence as string) ?? 'online');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  return (
    <AuthShell title="Profile">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await send(`/v1/orgs/${orgId}/profile`, { title, presence }, loadAccess(), 'PATCH');
        }}
      >
        <Field label="Title" value={title} onChange={setTitle} />
        <Field label="Presence" value={presence} onChange={setPresence} />
        {error ? <p role="alert">{error}</p> : null}
        <Button type="submit" disabled={busy}>
          Save profile
        </Button>
      </form>
    </AuthShell>
  );
}
