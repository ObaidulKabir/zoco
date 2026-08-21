import { ListOrgsUseCase } from './list-orgs.usecase';
import { Organization } from '../domain/organization';
import type { OrgDirectoryPort } from './ports/org-directory.port';

describe('ListOrgsUseCase', () => {
  it('returns organizations the user belongs to', async () => {
    const acme = new Organization(
      '1',
      'Acme',
      'acme',
      'Software',
      '11-50',
      'BD',
      'Asia/Dhaka',
      null,
      Organization.defaults('Asia/Dhaka'),
      new Date(),
    );
    const directory = {
      listOrgsForUser: (userId: string) => Promise.resolve(userId === 'u1' ? [acme] : []),
    } as Pick<OrgDirectoryPort, 'listOrgsForUser'> as OrgDirectoryPort;
    const result = await new ListOrgsUseCase(directory).execute('u1');
    expect(result.map((o) => o.slug)).toEqual(['acme']);
  });
});
