import * as express from 'express';
import { NetworkConnection } from './utils';

declare global {
  namespace Express {
    // Extend Express Request interface
    interface Request {
      veridaNetworkConnection?: NetworkConnection;
    }
  }
}