import jwt from 'jsonwebtoken';

export function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      statusCode: 401,
      error: 'TOKEN_LIPSA',
      message: 'Token de autentificare lipsa.',
    });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      fullName: decoded.fullName,
    };
    next();
  } catch {
    return res.status(401).json({
      statusCode: 401,
      error: 'TOKEN_INVALID',
      message: 'Token invalid sau expirat.',
    });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        statusCode: 401,
        error: 'NEAUTENTIFICAT',
        message: 'Trebuie sa fii autentificat.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        statusCode: 403,
        error: 'ACCES_INTERZIS',
        message: 'Nu ai permisiunea necesara pentru aceasta actiune.',
      });
    }

    next();
  };
}
