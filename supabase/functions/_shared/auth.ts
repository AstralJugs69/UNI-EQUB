import bcrypt from 'npm:bcryptjs@2.4.3';
import { SignJWT, jwtVerify } from 'npm:jose@5.9.6';
import { env } from './env.ts';
import type { UserRecord } from './types.ts';

const secret = new TextEncoder().encode(env.appJwtSecret);

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function signSession(user: UserRecord) {
  return new SignJWT({ role: user.Role, kyc: user.KYC_Status, phone: user.Phone_Number, purpose: 'session' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.User_ID)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function signLoginChallenge(user: UserRecord) {
  return new SignJWT({ role: user.Role, phone: user.Phone_Number, purpose: 'login_challenge' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.User_ID)
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(secret);
}

export async function signPendingKycToken(user: UserRecord) {
  return new SignJWT({ role: user.Role, phone: user.Phone_Number, purpose: 'pending_kyc' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.User_ID)
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(secret);
}

export async function verifySession(token: string) {
  const verified = await jwtVerify(token, secret);
  if (verified.payload.purpose !== 'session') {
    throw new Error('Invalid session token purpose.');
  }
  return verified.payload;
}

export async function verifyLoginChallenge(token: string) {
  const verified = await jwtVerify(token, secret);
  if (verified.payload.purpose !== 'login_challenge') {
    throw new Error('Invalid login challenge token.');
  }
  return verified.payload;
}

export async function verifyPendingKycToken(token: string) {
  const verified = await jwtVerify(token, secret);
  if (verified.payload.purpose !== 'pending_kyc') {
    throw new Error('Invalid pending KYC token.');
  }
  return verified.payload;
}

interface ContributionSessionInput {
  userId: string;
  phoneNumber: string;
  groupId: string;
  roundId: string;
  stage: string;
  amount: number;
  merchantRef: string;
}

export async function signContributionSession(input: ContributionSessionInput) {
  return new SignJWT({
    phone: input.phoneNumber,
    groupId: input.groupId,
    roundId: input.roundId,
    stage: input.stage,
    amount: input.amount,
    merchantRef: input.merchantRef,
    purpose: 'contribution_ussd',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret);
}

export async function verifyContributionSession(token: string) {
  const verified = await jwtVerify(token, secret);
  if (verified.payload.purpose !== 'contribution_ussd') {
    throw new Error('Invalid contribution session token.');
  }
  return verified.payload;
}
