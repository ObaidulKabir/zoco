import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { isPostgresEnabled } from './db/pool';
import { assertPortFree, loadRootEnv } from './load-env';
import { setupSwagger } from './openapi/document';

const allowedOrigins = (): string[] =>
  (process.env.CORS_ORIGINS ?? process.env.WEB_URL ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

async function bootstrap() {
  loadRootEnv();
  if (process.env.NODE_ENV === 'production' && !isPostgresEnabled()) {
    throw new Error('Refusing to start: production requires PERSISTENCE=postgres and a DATABASE_URL');
  }
  const port = Number(process.env.API_PORT ?? 3001);
  await assertPortFree(port);
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: allowedOrigins(), credentials: true });
  setupSwagger(app);
  await app.listen(port);
}

void bootstrap();
