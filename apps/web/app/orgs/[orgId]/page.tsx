'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthShell, loadAccess, storeOrg, useAuthApi } from '../../auth-ui';

type OrgPayload = {
  organization: { id: string; name: string; slug: string };
  channels: Array<{ name: string; slug: string }>;
  departments: Array<{ name: string }>;
};

export default function OrgHome({ params }: { params: { orgId: string } }) {
  const { error, send } = useAuthApi();
  const [data, setData] = useState<OrgPayload | null>(null);

  useEffect(() => {
    storeOrg(params.orgId);
    void (async () => {
      const json = await send(`/v1/orgs/${params.orgId}`, undefined, loadAccess(), 'GET');
      if (json?.data) setData(json.data as OrgPayload);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId]);

  return (
    <AuthShell title={data?.organization.name ?? 'Organization'}>
      {error ? <p role="alert">{error}</p> : null}
      <p>
        <Link href="/orgs">Switch organization</Link>
        {' · '}
        <Link href={`/orgs/${params.orgId}/invite`}>Invite</Link>
        {' · '}
        <Link href={`/orgs/${params.orgId}/settings`}>Settings</Link>
        {' · '}
        <Link href={`/orgs/${params.orgId}/profile`}>Profile</Link>
      </p>
      <h2>Channels</h2>
      <ul>
        {(data?.channels ?? []).map((ch) => (
          <li key={ch.slug}>#{ch.slug}</li>
        ))}
      </ul>
      <h2>Departments</h2>
      <ul>
        {(data?.departments ?? []).map((d) => (
          <li key={d.name}>{d.name}</li>
        ))}
      </ul>
    </AuthShell>
  );
}
