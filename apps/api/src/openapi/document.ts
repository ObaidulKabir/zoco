import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { ApiErrorBody, ApiErrorResponse } from './envelope';

const DESCRIPTION = `Zoqo is a self-hosted communication hub. Every response is an envelope:
\`{ "success": true, "data": ... }\` on success, \`{ "success": false, "error": { code, message, requestId } }\`
on failure (SRS §18.2). Quote the \`requestId\` — also returned as the \`X-Request-Id\` header — when reporting a problem.

Authenticate with the access token from \`POST /v1/auth/login\`. Organization-scoped routes also need the
\`X-Org-Id\` header naming the organization you are acting in.`;

export const buildOpenApiDocument = (app: INestApplication): OpenAPIObject => {
  const config = new DocumentBuilder()
    .setTitle('Zoqo API')
    .setDescription(DESCRIPTION)
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Access token, 15 minute lifetime.' },
      'access-token',
    )
    .addTag('auth', 'Registration, sign-in, sessions, password reset')
    .addTag('identity', 'People, independent of any organization')
    .addTag('org', 'Organizations, members, departments, teams, profiles')
    .addTag('platform', 'Health and readiness probes')
    .build();

  return SwaggerModule.createDocument(app, config, {
    extraModels: [ApiErrorBody, ApiErrorResponse],
  });
};

export const setupSwagger = (app: INestApplication): void => {
  SwaggerModule.setup('docs', app, buildOpenApiDocument(app), {
    jsonDocumentUrl: 'docs/openapi.json',
    swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha' },
  });
};
