import { Router } from 'express';

import { register , login , logout , getMe } from './auth.controller.js';
import { registerSchema , loginSchema } from '../users/user.validation.js';
import validate from '../../middleware/validate.js';
import authenticate from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/register', validate(registerSchema), register);

router.post('/login', validate(loginSchema), login);

router.post('/logout', logout);

router.get('/me' ,authenticate, getMe);

export default router;