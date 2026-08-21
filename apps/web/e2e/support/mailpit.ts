/**
 * Reads mail out of Mailpit so end-to-end journeys can complete a real
 * verification round trip.
 *
 * Locally the API is booted with E2E_EXPOSE_OTP=1 and hands the code back in
 * the response, which is fast and needs no mail server. That switch must never
 * be on in a deployed environment, so against staging the journeys collect the
 * code the way a person would: out of the inbox.
 */

const MAILPIT_URL = process.env.MAILPIT_URL?.replace(/\/$/, '');

export const mailpitEnabled = (): boolean => Boolean(MAILPIT_URL);

type MailpitSummary = { ID: string; Created: string };
type MailpitSearch = { messages?: MailpitSummary[] };
type MailpitMessage = { Text?: string; HTML?: string };

const base = (): string => {
  if (!MAILPIT_URL) throw new Error('MAILPIT_URL is not set');
  return MAILPIT_URL;
};

const getJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${base()}${path}`);
  if (!response.ok) {
    throw new Error(`mailpit ${path} responded ${response.status}`);
  }
  return (await response.json()) as T;
};

/**
 * Staging keeps mail from previous deploys, and a stale code for a recycled
 * address would be picked up ahead of the new one. Callers use a per-run
 * address, but clearing first also keeps the box from growing without bound.
 */
export async function clearMailbox(): Promise<void> {
  const response = await fetch(`${base()}/api/v1/messages`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`mailpit could not clear messages: ${response.status}`);
  }
}

async function latestMessageFor(address: string): Promise<MailpitMessage | null> {
  const query = encodeURIComponent(`to:${address}`);
  const search = await getJson<MailpitSearch>(`/api/v1/search?query=${query}&limit=20`);
  const messages = search.messages ?? [];
  if (!messages.length) return null;
  // Mailpit returns newest first, but sort rather than trust the ordering.
  const newest = [...messages].sort((a, b) => Date.parse(b.Created) - Date.parse(a.Created))[0];
  if (!newest) return null;
  return getJson<MailpitMessage>(`/api/v1/message/${newest.ID}`);
}

async function poll<T>(what: string, timeoutMs: number, attempt: () => Promise<T | null>): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const result = await attempt();
      if (result !== null) return result;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`timed out after ${timeoutMs}ms waiting for ${what}${lastError ? `: ${lastError}` : ''}`);
}

/** The verification mail carries a single six-digit code. */
export const waitForOtp = (address: string, timeoutMs = 30_000): Promise<string> =>
  poll(`an OTP for ${address}`, timeoutMs, async () => {
    const message = await latestMessageFor(address);
    const body = `${message?.Text ?? ''}${message?.HTML ?? ''}`;
    return /\b(\d{6})\b/.exec(body)?.[1] ?? null;
  });

/** Invitation and password-reset mails carry a link; used from Sprint 2 onward. */
export const waitForLink = (address: string, pattern: RegExp, timeoutMs = 30_000): Promise<string> =>
  poll(`a link matching ${pattern} for ${address}`, timeoutMs, async () => {
    const message = await latestMessageFor(address);
    const body = `${message?.Text ?? ''}${message?.HTML ?? ''}`;
    return pattern.exec(body)?.[0] ?? null;
  });
