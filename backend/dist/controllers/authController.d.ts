import { Request, Response } from 'express';
export declare const registerUser: (req: Request, res: Response) => Promise<void>;
export declare const loginUser: (req: Request, res: Response) => Promise<void>;
export declare const verifyEmail: (req: Request, res: Response) => Promise<void>;
export declare const resendOtp: (req: Request, res: Response) => Promise<void>;
export declare const seedAdmin: () => Promise<void>;
export declare const getAppVersion: (req: Request, res: Response) => Promise<void>;
export declare const updateProfile: (req: Request, res: Response) => Promise<void>;
export declare const googleAuth: (req: Request, res: Response) => Promise<void>;
