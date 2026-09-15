import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import type { User } from '../../generated/prisma/client';
import { ApiError } from '../../utils/ApiError';
import { comparePassword, hashPassword } from '../../utils/hash';
import {
  getTokenExpiry,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt';
import type { LoginInput, RegisterInput } from './auth.validation';

const googleClient = new OAuth2Client(env.googleClientId);

export type SafeUser = Omit<User, 'passwordHash' | 'googleId'>;

function toSafeUser(user: User): SafeUser {
  const { passwordHash: _passwordHash, googleId: _googleId, ...safe } = user;
  return safe;
}

async function issueTokenPair(userId: string, role: User['role']) {
  const accessToken = signAccessToken({ sub: userId, role });
  const refreshToken = signRefreshToken({ sub: userId });

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: getTokenExpiry(refreshToken),
    },
  });

  return { accessToken, refreshToken };
}

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      phone: input.phone,
      role: input.role,
    },
  });

  return toSafeUser(user);
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findFirst({
    where: { email: input.email, deletedAt: null },
  });

  if (!user?.passwordHash) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) {
    throw ApiError.forbidden('This account has been deactivated');
  }

  const passwordMatches = await comparePassword(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const tokens = await issueTokenPair(user.id, user.role);
  return { user: toSafeUser(user), ...tokens };
}

export async function loginWithGoogle(idToken: string) {
  let payload: { sub: string; email: string; name?: string; email_verified?: boolean };
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.googleClientId,
    });
    const verified = ticket.getPayload();
    if (!verified?.email) {
      throw new Error('Google token payload is missing an email');
    }
    payload = {
      sub: verified.sub,
      email: verified.email,
      name: verified.name,
      email_verified: verified.email_verified,
    };
  } catch {
    throw ApiError.unauthorized('Invalid Google ID token');
  }

  if (!payload.email_verified) {
    throw ApiError.unauthorized('Google account email is not verified');
  }

  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId: payload.sub }, { email: payload.email }], deletedAt: null },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: payload.name ?? payload.email.split('@')[0],
        email: payload.email,
        googleId: payload.sub,
        role: 'CUSTOMER',
      },
    });
  } else if (!user.googleId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId: payload.sub },
    });
  }

  if (!user.isActive) {
    throw ApiError.forbidden('This account has been deactivated');
  }

  const tokens = await issueTokenPair(user.id, user.role);
  return { user: toSafeUser(user), ...tokens };
}

export async function refreshTokens(refreshToken: string) {
  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (
    !stored ||
    stored.revokedAt ||
    stored.expiresAt < new Date() ||
    stored.userId !== payload.sub
  ) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await prisma.user.findFirst({ where: { id: payload.sub, deletedAt: null } });
  if (!user?.isActive) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const tokens = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const newRefreshToken = signRefreshToken({ sub: user.id });
    await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(newRefreshToken),
        expiresAt: getTokenExpiry(newRefreshToken),
      },
    });

    return { accessToken, refreshToken: newRefreshToken };
  });

  return tokens;
}

export async function logoutUser(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
