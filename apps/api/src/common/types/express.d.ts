// Extend Express Request type to include custom properties
declare namespace Express {
  export interface Request {
    correlationId?: string;
    user?: {
      id: string;
      email: string;
      roles?: string[];
    };
  }
}
