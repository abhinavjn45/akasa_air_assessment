import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { env } from '../src/config/env.js';

if (env.NODE_ENV === 'production') throw new Error('These integration checks are for a local development server only.');

const accounts = JSON.parse(await readFile(new URL('../.seed-credentials.json', import.meta.url), 'utf8'));
const baseUrl = `http://localhost:${env.PORT}/api/v1`;

async function call(path, { method = 'GET', body, token, cookie, origin = env.CORS_ORIGIN } = {}) {
  const headers = { Origin: origin };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${baseUrl}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = response.status === 204 ? null : await response.json();
  return { status: response.status, payload, cookie: response.headers.get('set-cookie') };
}

function cookieValue(header) {
  return header?.split(';', 1)[0];
}

test('local authentication and role-aware dashboard', async () => {
  const employee = accounts.find((account) => account.role === 'EMPLOYEE');
  assert.ok(employee);

  const denied = await call('/dashboard');
  assert.equal(denied.status, 401);

  const invalidOrigin = await call('/auth/login', { method: 'POST', body: {}, origin: 'https://invalid.example' });
  assert.equal(invalidOrigin.status, 403);

  const wrong = await call('/auth/login', {
    method: 'POST', body: { email: employee.email, password: 'incorrect-password', rememberMe: false },
  });
  const unknown = await call('/auth/login', {
    method: 'POST', body: { email: 'unknown-user@example.test', password: 'incorrect-password', rememberMe: false },
  });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(wrong.payload.error.message, unknown.payload.error.message);

  const sessions = {};
  for (const role of ['EMPLOYEE', 'MANAGER', 'HOD']) {
    const account = accounts.find((entry) => entry.role === role);
    assert.ok(account);
    const loggedIn = await call('/auth/login', {
      method: 'POST',
      body: { email: account.email, password: account.password, rememberMe: role === 'EMPLOYEE', role: 'HOD' },
    });
    assert.equal(loggedIn.status, 200);
    assert.equal(loggedIn.payload.data.user.role, role);
    assert.ok(/HttpOnly/i.test(loggedIn.cookie));
    assert.ok(/SameSite=Lax/i.test(loggedIn.cookie));
    if (role === 'EMPLOYEE') assert.ok(/Max-Age=/i.test(loggedIn.cookie));
    else assert.ok(!/Max-Age=/i.test(loggedIn.cookie));
    const token = loggedIn.payload.data.accessToken;
    const cookie = cookieValue(loggedIn.cookie);
    const dashboard = await call('/dashboard', { token });
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.payload.data.user.role, role);
    assert.ok(dashboard.payload.data.view.title);
    sessions[role] = { token, cookie };
  }

  const rotated = await call('/auth/refresh', { method: 'POST', body: {}, cookie: sessions.EMPLOYEE.cookie });
  assert.equal(rotated.status, 200);
  assert.ok(cookieValue(rotated.cookie) !== sessions.EMPLOYEE.cookie);
  assert.equal((await call('/dashboard', { token: sessions.EMPLOYEE.token })).status, 401);
  assert.equal((await call('/dashboard', { token: rotated.payload.data.accessToken })).status, 200);

  const replay = await call('/auth/refresh', { method: 'POST', body: {}, cookie: sessions.EMPLOYEE.cookie });
  assert.equal(replay.status, 401);
  assert.equal((await call('/dashboard', { token: rotated.payload.data.accessToken })).status, 401);

  for (const role of ['MANAGER', 'HOD']) {
    const result = await call('/auth/logout', { method: 'POST', body: {}, cookie: sessions[role].cookie, token: sessions[role].token });
    assert.equal(result.status, 204);
    assert.equal((await call('/dashboard', { token: sessions[role].token })).status, 401);
  }
});
