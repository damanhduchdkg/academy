import jwt from 'jsonwebtoken';

export type SessionClaims = { uid: string; lid: string };
const SECRET = process.env.LESSON_SESSION_JWT_SECRET || process.env.JWT_SECRET!;
const TTL_HOURS = Number(process.env.LESSON_SESSION_TTL_HOURS ?? 4);

export function signSessionToken(c: SessionClaims) {
  return jwt.sign(c, SECRET, { expiresIn: `${TTL_HOURS}h` });
}
export function verifySessionToken(tok: string): SessionClaims {
  return jwt.verify(tok, SECRET) as SessionClaims;
}
