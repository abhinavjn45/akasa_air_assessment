import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/security.js';
import { validate } from '../middlewares/validate.js';
import { emptyRequest } from '../validators/auth.js';
import { publicUser } from '../services/auth.js';

const router = Router();
const roleViews = {
  EMPLOYEE: { title: 'My leave', description: 'Submit leave requests and follow their progress.' },
  MANAGER: { title: 'Manager review', description: 'Review pending requests and record decisions.' },
  HOD: { title: 'HOD review', description: 'Review requests that need an additional decision.' },
};

router.get('/', requireAuth, requireRole('EMPLOYEE', 'MANAGER', 'HOD'), validate(emptyRequest), (req, res) => {
  return res.json({ data: { user: publicUser(req.auth), view: roleViews[req.auth.role_code] }, meta: { requestId: req.id } });
});

export default router;
