const prisma = require('../lib/prisma');
const { verifyLibrarianToken } = require('../lib/librarianToken');

function extractBearerToken(authorizationHeader) {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token.trim();
}

async function requireLibrarianAuth(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    return res.status(401).json({
      error: 'Missing or invalid Authorization header',
    });
  }

  try {
    const payload = verifyLibrarianToken(token);
    const librarianId = Number(payload.id);

    if (!librarianId) {
      return res.status(401).json({ error: 'Token payload is invalid' });
    }

    const librarian = await prisma.librarian.findUnique({
      where: { id: librarianId },
      select: {
        id: true,
        employeeId: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!librarian) {
      return res.status(401).json({ error: 'Librarian no longer exists' });
    }

    req.librarian = librarian;
    req.librarianAuth = payload;
    return next();
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid or expired librarian token',
    });
  }
}

module.exports = {
  requireLibrarianAuth,
};
