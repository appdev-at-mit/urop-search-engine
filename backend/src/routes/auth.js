import { Router } from 'express';
import passport from 'passport';
import { getDb } from '../db.js';

const router = Router();

router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.APP_URL || 'http://localhost:5173'}/profile?error=auth_failed` }),
  (req, res) => {
    const email = req.user?.email || '';
    if (!email.endsWith('@mit.edu')) {
      req.logout(() => {});
      return res.redirect(`${process.env.APP_URL || 'http://localhost:5173'}/profile?error=not_mit`);
    }
    res.redirect(`${process.env.APP_URL || 'http://localhost:5173'}/profile`);
  }
);

router.get('/me', async (req, res) => {
  if (!req.user) return res.json({ user: null });
  try {
    const db = await getDb();
    const fullUser = await db.collection('users').findOne(
      { googleId: req.user.googleId },
      { projection: { _id: 0, googleId: 1, email: 1, name: 1, picture: 1, major: 1, year: 1, interests: 1, skills: 1, bio: 1, gpa: 1 } }
    );
    res.json({ user: fullUser || { googleId: req.user.googleId, email: req.user.email, name: req.user.name, picture: req.user.picture } });
  } catch (_) {
    const { googleId, email, name, picture } = req.user;
    res.json({ user: { googleId, email, name, picture } });
  }
});

router.post('/logout', (req, res) => {
  req.logout(() => {
    res.json({ ok: true });
  });
});

export default router;
