const jwt = require('jsonwebtoken');

const verifyAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // Local/developer bypass if token matches developer fallback token
  if (token === 'mock-admin-token-akhil') {
    req.user = { email: 'akhilthadaka97@gmail.com' };
    return next();
  }

  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_sbs_123');
    const expectedAdminEmail = process.env.ADMIN_EMAIL || 'akhilthadaka97@gmail.com';
    if (decodedToken.email !== expectedAdminEmail) {
      return res.status(403).json({ error: 'Unauthorized: Admin access only.' });
    }
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }
};

module.exports = { verifyAdmin };
