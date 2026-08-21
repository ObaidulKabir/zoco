import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiProperty, ApiPropertyOptional, ApiResponse } from '@nestjs/swagger';

/** SRS §18.2. Every failure on every endpoint has this shape. */
export class ApiErrorBody {
  @ApiProperty({ type: String, example: 'VALIDATION_ERROR', description: 'Stable machine-readable code.' })
  code!: string;

  @ApiProperty({ type: String, example: 'Email is required' })
  message!: string;

  @ApiProperty({
    type: String,
    example: 'req_9f3c1a7b2d04',
    description: 'Also returned in the X-Request-Id header; quote it in bug reports.',
  })
  requestId!: string;

  @ApiPropertyOptional({ type: Object, additionalProperties: true })
  details?: Record<string, unknown>;
}

export class ApiErrorResponse {
  @ApiProperty({ type: Boolean, example: false })
  success!: false;

  @ApiProperty({ type: ApiErrorBody })
  error!: ApiErrorBody;
}

const error = (status: number, description: string) =>
  ApiResponse({ status, description, type: ApiErrorResponse });

/** The failures every authenticated endpoint can return, so routes only declare what is unusual. */
export const ApiAuthedErrors = (): MethodDecorator =>
  applyDecorators(
    error(400, 'Request failed validation.'),
    error(401, 'Missing, expired, or invalid access token.'),
    error(403, 'Authenticated but not allowed to do this.'),
  );

/** Credential endpoints additionally shed load under SYS-SEC-006. */
export const ApiCredentialErrors = (): MethodDecorator =>
  applyDecorators(
    error(400, 'Request failed validation.'),
    error(429, 'Rate limited: 5 attempts per 15 minutes per IP.'),
  );

/**
 * Routes behind OrgGuard. The organization comes from the X-Org-Id header or the
 * path, and the two must agree when both are present.
 */
export const ApiOrgScoped = (): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth('access-token'),
    ApiHeader({
      name: 'X-Org-Id',
      required: false,
      description: 'Acting organization. Required when the path has no :orgId, and must match it when it does.',
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiAuthedErrors(),
  );

export const ApiNotFound = (description: string): MethodDecorator => error(404, description);

export const ApiConflict = (description: string): MethodDecorator => error(409, description);
