const baseUrl = import.meta.env.VITE_API_BASE_URL;
let accessToken = null;
let refreshInFlight = null;

export function setAccessToken(token) {
  accessToken = token;
}

async function send(path, { method = 'GET', body, authenticated = false, binary = false, includeMeta = false } = {}) {
  if (!baseUrl) throw new Error('The frontend API is not configured.');
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (authenticated && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = response.status === 204 ? null : binary && response.ok ? await response.blob() : await response.json().catch(() => null);
  if (!response.ok) {
    throw Object.assign(new Error(payload?.error?.message || 'The request could not be completed.'), {
      status: response.status,
      code: payload?.error?.code,
    });
  }
  return binary || includeMeta ? payload : payload?.data ?? null;
}

export function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = send('/auth/refresh', { method: 'POST', body: {} })
      .then((data) => {
        setAccessToken(data.accessToken);
        return data.user;
      })
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export async function request(path, options = {}) {
  try {
    return await send(path, options);
  } catch (error) {
    if (error.status !== 401 || !options.authenticated) throw error;
    await refreshSession();
    return send(path, options);
  }
}
