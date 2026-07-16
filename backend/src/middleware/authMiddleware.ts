import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';

export interface AuthRequest extends Request {
  user?: IUser;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token as string;
  } else if (req.query.downloadToken) {
    token = req.query.downloadToken as string;
  }

  if (token) {
    try {
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
      
      // If this is a download-specific token, restrict it to download routes
      if (decoded.purpose === 'download') {
        const isDownloadRoute = req.path.includes('/download') || req.path.includes('/bulk-download');
        if (!isDownloadRoute) {
          return res.status(401).json({ message: 'Token not authorized for this action' });
        }
        
        // Verify requested file matches the token scope
        const fileId = req.params.id || req.query.fileId;
        if (decoded.fileId && fileId && decoded.fileId !== fileId) {
          return res.status(401).json({ message: 'Token not authorized for this file' });
        }
        
        const requestedIds = req.query.fileIds as string;
        if (decoded.fileIds && requestedIds && decoded.fileIds !== requestedIds) {
          return res.status(401).json({ message: 'Token not authorized for these files' });
        }
      }

      req.user = (await User.findById(decoded.id).select('-passwordHash')) as IUser;
      return next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

export const admin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(401).json({ message: 'Not authorized as an admin' });
  }
};

export const approved = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user && req.user.status === 'approved') {
    next();
  } else {
    res.status(403).json({ message: 'Account not approved. Please contact admin.' });
  }
};
