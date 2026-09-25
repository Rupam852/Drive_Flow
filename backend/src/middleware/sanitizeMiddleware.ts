import { Request, Response, NextFunction } from 'express';

/**
 * Recursively inspects an object to detect NoSQL injection operators (keys starting with '$' or containing '.')
 */
const hasNoSqlInjection = (obj: any): boolean => {
  if (!obj || typeof obj !== 'object') return false;

  for (const key of Object.keys(obj)) {
    // Check if key is a MongoDB operator like $ne, $gt, $where, or dot-notation traversal
    if (key.startsWith('$') || key.includes('.')) {
      return true;
    }

    if (typeof obj[key] === 'object' && obj[key] !== null) {
      if (hasNoSqlInjection(obj[key])) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Middleware to sanitize and block NoSQL injection attacks in req.body, req.query, and req.params
 * Safe for mobile apps and standard JSON payloads.
 */
export const sanitizeNoSql = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.body && hasNoSqlInjection(req.body)) {
      console.warn(`[Security Alert] Blocked suspected NoSQL injection in body from IP: ${req.ip}`);
      return res.status(400).json({ message: 'Invalid query operators detected in request payload.' });
    }

    if (req.query && hasNoSqlInjection(req.query)) {
      console.warn(`[Security Alert] Blocked suspected NoSQL injection in query from IP: ${req.ip}`);
      return res.status(400).json({ message: 'Invalid query operators detected in request query.' });
    }

    if (req.params && hasNoSqlInjection(req.params)) {
      console.warn(`[Security Alert] Blocked suspected NoSQL injection in params from IP: ${req.ip}`);
      return res.status(400).json({ message: 'Invalid query operators detected in URL parameters.' });
    }

    next();
  } catch (err) {
    next(err);
  }
};
