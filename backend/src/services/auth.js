import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { httpError } from '../utils/http-error.js';

const dummyHash = bcrypt.hash(randomBytes(32).toString('hex'), 12);
const sessionDay = 24 * 60 * 60 * 1000;
const invalidCredentials = () => httpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
const invalidSession = () => httpError(401, 'INVALID_SESSION', 'Please sign in again.');
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

function publicUser(row) {
  return { id: row.id, email: row.email, displayName: row.display_name, role: row.role_code };
}

function accessToken(userId, sessionId) {
  return jwt.sign({ sid: sessionId }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256', subject: userId, issuer: 'leave-tracker', audience: 'leave-tracker-web', expiresIn: '10m',
  });
}

async function recordFailure(userId) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      'SELECT failed_login_attempts, locked_until FROM users WHERE id = ? FOR UPDATE', [userId],
    );
    const user = rows[0];
    const now = new Date();
    if (user && (!user.locked_until || user.locked_until <= now)) {
      const count = user.locked_until ? 1 : user.failed_login_attempts + 1;
      const lockUntil = count >= 5 ? new Date(now.getTime() + 15 * 60 * 1000) : null;
      await connection.execute('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?', [count, lockUntil, userId]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function writeAudit(connection, actorId, action, requestId) {
  await connection.execute(
    'INSERT INTO audit_events (id, actor_user_id, action, request_id) VALUES (?, ?, ?, ?)',
    [randomUUID(), actorId, action, requestId],
  );
}

export async function login({ email, password, rememberMe }, requestId) {
  const [rows] = await db.execute(
    'SELECT id, email, display_name, password_hash, role_code, is_active, locked_until FROM users WHERE email = ?',
    [email],
  );
  const user = rows[0];
  const locked = user?.locked_until && user.locked_until > new Date();
  const hash = user && user.is_active && !locked ? user.password_hash : await dummyHash;
  const matches = await bcrypt.compare(password, hash);

  if (!user || !user.is_active || locked || !matches) {
    if (user && user.is_active && !locked) await recordFailure(user.id);
    throw invalidCredentials();
  }

  const sessionId = randomUUID();
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + sessionDay * (rememberMe ? 30 : 1));
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [user.id]);
    await connection.execute(
      'INSERT INTO refresh_sessions (id, user_id, family_id, token_hash, remember_me, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, user.id, sessionId, hashToken(token), rememberMe, expiresAt],
    );
    await writeAudit(connection, user.id, 'LOGIN', requestId);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return { token, expiresAt, rememberMe, accessToken: accessToken(user.id, sessionId), user: publicUser(user) };
}

export async function refresh(token, requestId) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw invalidSession();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT s.id AS session_id, s.family_id, s.expires_at, s.revoked_at, s.remember_me,
              u.id, u.email, u.display_name, u.role_code, u.is_active
       FROM refresh_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? FOR UPDATE`,
      [hashToken(token)],
    );
    const session = rows[0];
    if (!session) {
      await connection.rollback();
      throw invalidSession();
    }

    if (session.revoked_at || session.expires_at <= new Date() || !session.is_active) {
      await connection.execute(
        'UPDATE refresh_sessions SET revoked_at = COALESCE(revoked_at, ?) WHERE family_id = ?',
        [new Date(), session.family_id],
      );
      await writeAudit(connection, session.id, 'SESSION_REVOKED', requestId);
      await connection.commit();
      throw invalidSession();
    }

    const newId = randomUUID();
    const newToken = randomBytes(32).toString('base64url');
    await connection.execute(
      'INSERT INTO refresh_sessions (id, user_id, family_id, token_hash, remember_me, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [newId, session.id, session.family_id, hashToken(newToken), session.remember_me, session.expires_at],
    );
    await connection.execute('UPDATE refresh_sessions SET revoked_at = ?, replaced_by_id = ? WHERE id = ?', [new Date(), newId, session.session_id]);
    await connection.commit();
    return {
      token: newToken,
      expiresAt: session.expires_at,
      rememberMe: Boolean(session.remember_me),
      accessToken: accessToken(session.id, newId),
      user: publicUser(session),
    };
  } catch (error) {
    if (error.status !== 401) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function logout(userId, sessionId, requestId) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT family_id, user_id FROM refresh_sessions WHERE id = ? AND user_id = ? FOR UPDATE', [sessionId, userId]);
    if (rows.length) {
      await connection.execute('UPDATE refresh_sessions SET revoked_at = COALESCE(revoked_at, ?) WHERE family_id = ?', [new Date(), rows[0].family_id]);
      await writeAudit(connection, rows[0].user_id, 'LOGOUT', requestId);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export { publicUser };
