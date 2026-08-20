import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { assertPortFree, loadRootEnv } from './load-env';

async function bootstrap() {
  loadRootEnv();
  const port = Number(process.env.API_PORT ?? 3001);
  await assertPortFree(port);
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });
  await app.listen(port);
}

void bootstrap();
