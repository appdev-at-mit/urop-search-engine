import { Router } from 'express';
import passport from 'passport';

const router = Router();

// Start Google OAuth flow
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}));

// Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.APP_URL || 'http://localhost:5173'}/profile?error=auth_failed` }),
  (req, res) => {
    // Check MIT email restriction
    const email = req.user?.email || '';
    if (!email.endsWith('@mit.edu')) {
      req.logout(() => {});
      return res.redirect(`${process.env.APP_URL || 'http://localhost:5173'}/profile?error=not_mit`);
    }
    res.redirect(`${process.env.APP_URL || 'http://localhost:5173'}/profile`);
  }
);

// Get current user
router.get('/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  const { googleId, email, name, picture } = req.user;
  res.json({ user: { googleId, email, name, picture } });
});

// Logout
router.post('/logout', (req, res) => {
  req.logout(() => {
    res.json({ ok: true });
  });
});

export default router;
