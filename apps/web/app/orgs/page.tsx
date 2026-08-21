'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthShell, loadAccess, storeOrg, useAuthApi } from '../auth-ui';
import { Button } from '@zoqo/ui';

type Org = { id: string; name: string; slug: string; industry: string };

export default function OrgsPage() {
  const { error, send } = useAuthApi();
  const [orgs, setOrgs] = useState<Org[]>([]);

  useEffect(() => {
    void (async () => {
      const json = await send('/v1/orgs', undefined, loadAccess(), 'GET');
      if (json?.data) setOrgs(json.data as Org[]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthShell title="Organizations">
      {error ? <p role="alert">{error}</p> : null}
      <p>
        <Link href="/orgs/new">Create organization</Link>
      </p>
      <ul>
        {orgs.map((org) => (
          <li key={org.id}>
            <button
              type="button"
              onClick={() => {
                storeOrg(org.id);
                window.location.href = `/orgs/${org.id}`;
              }}
            >
              Switch to {org.name}
            </button>
            {' — '}
            <Link href={`/orgs/${org.id}`}>{org.slug}</Link>
          </li>
        ))}
      </ul>
      {orgs.length === 0 ? <p>No organizations yet.</p> : null}
    </AuthShell>
  );
}
