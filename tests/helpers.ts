import request from 'supertest';
import { app } from '../src/app';

export const api = request(app);

export const DEMO_PASSWORD = 'Passw0rd!123';

export const SEEDED = {
  admin: { email: 'admin@courierlogistics.dev', password: DEMO_PASSWORD },
  alice: { email: 'alice@example.com', password: DEMO_PASSWORD },
  bob: { email: 'bob@example.com', password: DEMO_PASSWORD },
  carl: { email: 'carl@example.com', password: DEMO_PASSWORD },
  dana: { email: 'dana@example.com', password: DEMO_PASSWORD },
};

export interface AuthedUser {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

export async function loginAs(email: string, password: string): Promise<AuthedUser> {
  const res = await api.post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    accessToken: res.body.data.accessToken,
    refreshToken: res.body.data.refreshToken,
    userId: res.body.data.user.id,
  };
}

export function authHeader(user: AuthedUser) {
  return { Authorization: `Bearer ${user.accessToken}` };
}

let uniqueCounter = 0;
export function uniqueEmail(prefix: string): string {
  uniqueCounter += 1;
  return `${prefix}-${Date.now()}-${uniqueCounter}@test-suite.local`;
}
