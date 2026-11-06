import jwt from 'jsonwebtoken';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { httpError } from '../utils/http-error.js';

export function requireTrustedOrigin(req, _res, next) {
  if (req.get('origin') !== env.CORS_ORIGIN) {
    return next(httpError(403, 'INVALID_ORIGIN', 'The request origin is not allowed.'));
  }
  return next();
}

export async function requireAuth(req, _res, next) {
  try {
    const match = /^Bearer ([^\s]+)$/.exec(req.get('authorization') || '');
    if (!match) throw httpError(401, 'UNAUTHENTICATED', 'Please sign in.');

    let claims;
    try {
      claims = jwt.verify(match[1], env.JWT_ACCESS_SECRET, {
        algorithms: ['HS256'], issuer: 'leave-tracker', audience: 'leave-tracker-web',
      });
    } catch {
      throw httpError(401, 'UNAUTHENTICATED', 'Please sign in.');
    }
    if (typeof claims !== 'object' || typeof claims.sub !== 'string' || typeof claims.sid !== 'string') {
      throw httpError(401, 'UNAUTHENTICATED', 'Please sign in.');
    }

    const [rows] = await db.execute(
      `SELECT u.id, u.email, u.display_name, u.role_code, s.id AS session_id
       FROM users u JOIN refresh_sessions s ON s.user_id = u.id
       WHERE u.id = ? AND s.id = ? AND u.is_active = 1 AND s.revoked_at IS NULL AND s.expires_at > ?`,
      [claims.sub, claims.sid, new Date()],
    );
    if (!rows.length) throw httpError(401, 'UNAUTHENTICATED', 'Please sign in.');
    req.auth = rows[0];
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.auth || !roles.includes(req.auth.role_code)) {
      return next(httpError(403, 'FORBIDDEN', 'You do not have access to this resource.'));
    }
    return next();
  };
}
