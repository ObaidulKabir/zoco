'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthShell, Field, loadAccess, storeOrg, useAuthApi } from '../../auth-ui';
import { Button } from '@zoqo/ui';

export default function NewOrgPage() {
  const router = useRouter();
  const { error, busy, send } = useAuthApi();
  const [name, setName] = useState('Acme');
  const [industry, setIndustry] = useState('Software');
  const [size, setSize] = useState('11-50');
  const [country, setCountry] = useState('BD');
  const [timezone, setTimezone] = useState('Asia/Dhaka');

  return (
    <AuthShell title="Create organization">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const json = await send(
            '/v1/orgs',
            { name, industry, size, country, timezone },
            loadAccess(),
          );
          const id = json?.data?.organization?.id as string | undefined;
          if (id) {
            storeOrg(id);
            router.push(`/orgs/${id}`);
          }
        }}
      >
        <Field label="Name" value={name} onChange={setName} />
        <Field label="Industry" value={industry} onChange={setIndustry} />
        <Field label="Size" value={size} onChange={setSize} />
        <Field label="Country" value={country} onChange={setCountry} />
        <Field label="Timezone" value={timezone} onChange={setTimezone} />
        {error ? <p role="alert">{error}</p> : null}
        <Button type="submit" disabled={busy}>
          Create
        </Button>
      </form>
    </AuthShell>
  );
}
