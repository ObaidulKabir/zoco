import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('health (int)', () => {
  it('GET /health and /ready return 200', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.useLogger(false);
    await app.init();
    await request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
    await request(app.getHttpServer()).get('/ready').expect(200);
    await app.close();
  }, 30000);
});
