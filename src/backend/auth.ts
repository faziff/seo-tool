import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { db, UserEntity } from './db.js';

const configuredJwtSecret = (process.env.JWT_SECRET || '').trim();
if (process.env.NODE_ENV === 'production' && (configuredJwtSecret.length < 32 || configuredJwtSecret.toLowerCase().includes('change_me'))) {
  throw new Error('Set JWT_SECRET to a unique random value of at least 32 characters before running CROX in production.');
}
// Avoid a known hard-coded fallback. When unset locally, sessions are intentionally
// ephemeral; set JWT_SECRET in .env if local sessions should survive restarts.
const JWT_SECRET = configuredJwtSecret || randomBytes(48).toString('hex');
if (!configuredJwtSecret && process.env.NODE_ENV !== 'production') {
  console.warn('[CROX Auth] JWT_SECRET is unset; using a temporary development secret. Sessions will expire after a server restart.');
}
const TOKEN_EXPIRY = '7d';

export interface AuthTokenPayload {
  userId: number;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: UserEntity;
}

export function hashPassword(plainText: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(plainText, salt);
}

export function verifyPassword(plainText: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(plainText, hash);
  } catch {
    return false;
  }
}

export function generateToken(user: UserEntity): string {
  const payload: AuthTokenPayload = {
    userId: user.id,
    email: user.email
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ detail: 'Authentication required. Please log in.' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ detail: 'Session expired or invalid token. Please log in again.' });
  }

  const user = db.findUserById(decoded.userId);
  if (!user) {
    return res.status(401).json({ detail: 'User account not found.' });
  }

  req.user = user;
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const admin = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!admin) {
    return res.status(403).json({ detail: 'ADMIN_EMAIL is not configured on the server.' });
  }
  if (!req.user || req.user.email.toLowerCase() !== admin) {
    return res.status(403).json({ detail: 'Admin access required.' });
  }
  next();
}

export function clientIp(req: Request): string {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (decoded) {
      const user = db.findUserById(decoded.userId);
      if (user) {
        req.user = user;
      }
    }
  }
  next();
}

// Plan Limits and Entitlements
export const PLAN_LIMITS = {
  free: {
    maxPagesPerScan: 15,
    maxScansPerMonth: 5,
    exportCsv: true,
    compareScans: true,
    competitorAnalysis: false,
    aiSuggestions: true,
    maxConcurrentScans: 1
  },
  pro: {
    maxPagesPerScan: 100,
    maxScansPerMonth: 50,
    exportCsv: true,
    compareScans: true,
    competitorAnalysis: true,
    aiSuggestions: true,
    maxConcurrentScans: 3
  },
  agency: {
    maxPagesPerScan: 500,
    maxScansPerMonth: 9999,
    exportCsv: true,
    compareScans: true,
    competitorAnalysis: true,
    aiSuggestions: true,
    maxConcurrentScans: 10
  }
};
