export function httpError(status, code, message, details = []) {
  return Object.assign(new Error(message), { status, code, details });
}
