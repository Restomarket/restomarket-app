import request from 'supertest';
import { E2ETestSetup } from './helpers';

describe('AppController (e2e)', () => {
  let testSetup: E2ETestSetup;

  beforeAll(async () => {
    testSetup = await new E2ETestSetup().withAppModule().setupApp();
  });

  afterAll(async () => {
    await testSetup.teardown();
  });

  it('/health (GET)', () => {
    return request(testSetup.serverHttp).get('/health').expect(200);
  });
});
