import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginController, logoutController, meController, refreshController } from '../controllers/auth.js';
import { asyncHandler } from '../middlewares/errors.js';
import { requireAuth, requireTrustedOrigin } from '../middlewares/security.js';
import { validate } from '../middlewares/validate.js';
import { emptyObject, emptyRequest, loginBody } from '../validators/auth.js';

const router = Router();
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({
    error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.', details: [], requestId: req.id },
  }),
});

router.post('/login', requireTrustedOrigin, loginLimit, validate({ body: loginBody, query: emptyObject, params: emptyObject }), asyncHandler(loginController));
router.post('/refresh', requireTrustedOrigin, validate(emptyRequest), asyncHandler(refreshController));
router.post('/logout', requireTrustedOrigin, requireAuth, validate(emptyRequest), asyncHandler(logoutController));
router.get('/me', requireAuth, validate(emptyRequest), meController);

export default router;
