export function handleError(error, req, res, _next) {
  let status = error.status || 500;
  let code = error.status ? error.code : 'INTERNAL_ERROR';
  let message = error.status ? error.message : 'Something went wrong. Please try again.';

  if (error.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'The request is too large.';
  } else if (error.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'The request contains invalid JSON.';
  }

  if (status >= 500) {
    console.error(JSON.stringify({ level: 'error', requestId: req.id, code: error.code || 'INTERNAL_ERROR' }));
  }

  return res.status(status).json({
    error: { code, message, details: error.status ? error.details || [] : [], requestId: req.id },
  });
}

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
