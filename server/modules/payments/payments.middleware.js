import jwt from 'jsonwebtoken';
import { supabase } from '../../config/db.js';

/**
 * Authentication Middleware: Reuses Supabase JWT or custom JWT
 */
export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Authorization header missing' });

  const token = authHeader.split(' ')[1];
  try {
    // Attempt to verify with Supabase first or fallback to custom secret
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      // Fallback for custom JWT if applicable
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } else {
      req.user = user;
    }
    
    // Fetch user role from workers/profiles table
    const { data: worker } = await supabase
      .from('workers')
      .select('role')
      .eq('auth_user_id', req.user.id)
      .single();
    
    req.user.role = worker?.role || 'READ_ONLY';
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * RBAC Middleware: Define allowed roles for routes
 */
export const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'User not authenticated' });
    
    // Convert current role to uppercase for match
    const userRole = req.user.role.toUpperCase().replace(' ', '_');
    const hasRole = allowedRoles.some(role => userRole.includes(role));

    if (!hasRole && req.user.role !== 'Admin') {
      return res.status(403).json({ error: `Access denied: Role ${req.user.role} unauthorized` });
    }
    next();
  };
};

/**
 * Idempotency Middleware: Check X-Idempotency-Key header
 */
const idempotencyCache = new Map();
export const checkIdempotency = (req, res, next) => {
  const key = req.headers['x-idempotency-key'];
  if (!key) return next();

  if (idempotencyCache.has(key)) {
    console.log(`[Idempotency] Cached response for key: ${key}`);
    return res.status(200).json(idempotencyCache.get(key));
  }

  // Wrap res.json to cache response
  const originalJson = res.json;
  res.json = (data) => {
    idempotencyCache.set(key, data);
    // Cleanup after 24h
    setTimeout(() => idempotencyCache.delete(key), 86400000);
    return originalJson.call(res, data);
  };

  next();
};
