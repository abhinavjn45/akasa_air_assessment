import { env } from '../config/env.js';
import { login, logout, publicUser, refresh } from '../services/auth.js';

const cookieName = 'refresh_token';
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/v1/auth',
};

function sendSession(res, session, requestId) {
  const options = { ...cookieOptions };
  if (session.rememberMe) options.maxAge = Math.max(0, session.expiresAt.getTime() - Date.now());
  res.cookie(cookieName, session.token, options);
  return res.json({ data: { accessToken: session.accessToken, user: session.user }, meta: { requestId } });
}

export async function loginController(req, res) {
  const session = await login(req.validated.body, req.id);
  return sendSession(res, session, req.id);
}

export async function refreshController(req, res) {
  try {
    const session = await refresh(req.cookies[cookieName], req.id);
    return sendSession(res, session, req.id);
  } catch (error) {
    if (error.status === 401) res.clearCookie(cookieName, cookieOptions);
    throw error;
  }
}

export async function logoutController(req, res) {
  await logout(req.auth.id, req.auth.session_id, req.id);
  res.clearCookie(cookieName, cookieOptions);
  return res.status(204).end();
}

export function meController(req, res) {
  return res.json({ data: { user: publicUser(req.auth) }, meta: { requestId: req.id } });
}
