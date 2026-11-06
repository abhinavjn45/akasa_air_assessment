import { httpError } from '../utils/http-error.js';

export function validate(schemas) {
  return (req, _res, next) => {
    const validated = {};

    for (const [key, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[key] ?? {});
      if (!result.success) {
        const details = result.error.issues.map((issue) => ({
          path: [key, ...issue.path].join('.'),
          code: issue.code,
          message: 'Enter a valid value.',
        }));
        return next(httpError(400, 'VALIDATION_ERROR', 'The request is invalid.', details));
      }
      validated[key] = result.data;
    }

    req.validated = validated;
    return next();
  };
}
