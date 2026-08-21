'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthShell, loadAccess, storeOrg, useAuthApi } from '../../auth-ui';

type OrgPayload = {
  organization: { id: string; name: string; slug: string };
  channels: Array<{ name: string; slug: string }>;
  departments: Array<{ name: string }>;
};

export default function OrgHome() {
  // Read through the hook rather than the params prop: as of Next 15 that prop
  // is a promise, and unwrapping it with use() would require React 19.
  const { orgId } = useParams<{ orgId: string }>();
  const { error, send } = useAuthApi();
  const [data, setData] = useState<OrgPayload | null>(null);

  useEffect(() => {
    storeOrg(orgId);
    void (async () => {
      const json = await send(`/v1/orgs/${orgId}`, undefined, loadAccess(), 'GET');
      if (json?.data) setData(json.data as OrgPayload);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  return (
    <AuthShell title={data?.organization.name ?? 'Organization'}>
      {error ? <p role="alert">{error}</p> : null}
      <p>
        <Link href="/orgs">Switch organization</Link>
        {' · '}
        <Link href={`/orgs/${orgId}/messages`}>Direct Messages</Link>
        {' · '}
        <Link href={`/orgs/${orgId}/invite`}>Invite</Link>
        {' · '}
        <Link href={`/orgs/${orgId}/settings`}>Settings</Link>
        {' · '}
        <Link href={`/orgs/${orgId}/profile`}>Profile</Link>
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
