import Link from 'next/link';
import { Button } from '@zoqo/ui';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function HomePage() {
  return (
    <main>
      <h1>Zoqo</h1>
      <p>Sign in with email and password. No OAuth in Phase 1.</p>
      <p>
        <Link href="/register">Register</Link>
        {' · '}
        <Link href="/login">Login</Link>
        {' · '}
        <Link href="/orgs">Organizations</Link>
        {' · '}
        <Link href="/sessions">Sessions</Link>
      </p>
      <p>
        API: <a href={`${apiBase}/health`}>{apiBase}/health</a>
      </p>
      <Button>Continue</Button>
    </main>
  );
}
