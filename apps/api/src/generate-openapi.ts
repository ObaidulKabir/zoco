import 'reflect-metadata';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadRootEnv } from './load-env';
import { buildOpenApiDocument } from './openapi/document';

const OUTPUT = join(__dirname, '../../../docs/api/openapi.json');

const serialize = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

type Operation = { summary?: string; tags?: string[]; responses?: Record<string, unknown> };

/** The standing rule is that endpoints are documented, not merely present. */
function assertEveryOperationDocumented(document: { paths: Record<string, Record<string, Operation>> }): void {
  const undocumented: string[] = [];
  for (const [path, methods] of Object.entries(document.paths)) {
    for (const [verb, operation] of Object.entries(methods)) {
      const problems: string[] = [];
      if (!operation.summary) problems.push('no summary');
      if (!operation.tags?.length) problems.push('no tag');
      if (!Object.keys(operation.responses ?? {}).length) problems.push('no documented response');
      if (problems.length) undocumented.push(`${verb.toUpperCase()} ${path}: ${problems.join(', ')}`);
    }
  }
  if (undocumented.length) {
    throw new Error(`Undocumented endpoints:\n  ${undocumented.join('\n  ')}`);
  }
}

async function render(): Promise<string> {
  loadRootEnv();
  process.env.PERSISTENCE = 'memory';
  // A full app is needed for the HTTP adapter's route table, but it never listens.
  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    await app.init();
    const document = buildOpenApiDocument(app);
    assertEveryOperationDocumented(document as never);
    return serialize(document);
  } finally {
    await app.close();
  }
}

async function main(): Promise<void> {
  const document = await render();
  const check = process.argv.includes('--check');

  if (!check) {
    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, document, 'utf8');
    // eslint-disable-next-line no-console
    console.log(`openapi: wrote ${OUTPUT}`);
    return;
  }

  const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, 'utf8') : '';
  if (current !== document) {
    throw new Error(
      'docs/api/openapi.json is out of date. Every endpoint joins the document in the same PR ' +
        '(sprint plan §1). Run `pnpm openapi` and commit the result.',
    );
  }
  // eslint-disable-next-line no-console
  console.log('openapi: document is up to date');
}

main().catch((error: Error) => {
  // eslint-disable-next-line no-console
  console.error(error.message);
  process.exit(1);
});
