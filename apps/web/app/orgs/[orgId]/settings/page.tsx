'use client';

import { useEffect, useState } from 'react';
import { AuthShell, Field, loadAccess, storeOrg, useAuthApi } from '../../../auth-ui';
import { Button } from '@zoqo/ui';

export default function SettingsPage({ params }: { params: { orgId: string } }) {
  const { error, busy, send } = useAuthApi();
  const [policy, setPolicy] = useState('admins_only');
  const [saved, setSaved] = useState('');
  storeOrg(params.orgId);

  useEffect(() => {
    void (async () => {
      const json = await send(`/v1/orgs/${params.orgId}`, undefined, loadAccess(), 'GET');
      const current = json?.data?.organization?.settings?.invitationPolicy as string | undefined;
      if (current) setPolicy(current);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId]);

  return (
    <AuthShell title="Organization settings">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const json = await send(
            `/v1/orgs/${params.orgId}`,
            { invitationPolicy: policy },
            loadAccess(),
            'PATCH',
          );
          if (json) setSaved('Saved');
        }}
      >
        <Field label="Invitation policy" value={policy} onChange={setPolicy} />
        {error ? <p role="alert">{error}</p> : null}
        {saved ? <p>{saved}</p> : null}
        <Button type="submit" disabled={busy}>
          Save settings
        </Button>
      </form>
    </AuthShell>
  );
}
