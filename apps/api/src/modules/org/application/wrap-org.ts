import { err, ok, type Result } from '@zoqo/shared';
import { isOrgError, type OrgError } from '../domain/org-error';

export const wrapOrg = async <T>(fn: () => Promise<T>): Promise<Result<T, OrgError>> => {
  try {
    return ok(await fn());
  } catch (error) {
    if (isOrgError(error)) return err(error);
    throw error;
  }
};
