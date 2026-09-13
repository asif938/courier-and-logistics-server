import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { Role } from '../generated/prisma/client';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

export interface RefreshTokenPayload {
  sub: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.jwt.refreshSecret) as RefreshTokenPayload;
}

// Refresh tokens are opaque, high-entropy JWTs; we only ever need to check
// "does this exact token match a stored, unrevoked record", so a fast SHA-256
// digest (not bcrypt) is stored instead of the raw token.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Reads the `exp` claim back off a just-signed token instead of re-parsing
// JWT_REFRESH_EXPIRES_IN, so the stored expiry can never drift from the token's own.
export function getTokenExpiry(token: string): Date {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === 'string' || !decoded.exp) {
    throw new Error('Token does not have a valid exp claim');
  }
  return new Date(decoded.exp * 1000);
}
