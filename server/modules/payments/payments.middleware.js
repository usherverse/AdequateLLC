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
    let { data: worker, error: workerError } = await supabase
      .from('workers')
      .select('role')
      .eq('id', req.user.id)
      .maybeSingle();
    
    // Fallback to email lookup if ID fails (common in early dev/testing)
    if (!worker && !workerError) {
      const { data: wByEmail } = await supabase
        .from('workers')
        .select('role')
        .eq('email', req.user.email)
        .maybeSingle();
      worker = wByEmail;
    }
    
    if (workerError) console.error('[AuthMiddleware] Worker lookup error:', workerError);

    req.user.role = worker?.role || 'READ_ONLY';
    // Debug logging
    console.log(`[AuthMiddleware] User: ${req.user.email} (${req.user.id}), Identified Role: ${req.user.role}`);
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
    const userRole = (req.user.role || 'READ_ONLY').toUpperCase().trim().replace(/\s+/g, '_');
    const hasRole = allowedRoles.some(role => userRole.includes(role));

    // Wildcard bypass for Admin/SuperAdmin
    if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || hasRole) {
      return next();
    }

    return res.status(403).json({ error: `Access denied: Role ${req.user.role} unauthorized for this route` });
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

/**
 * Validation Middleware: Sanitize and validate request data using Zod schema
 */
export const validate = (schema) => (req, res, next) => {
  try {
    if (req.method === 'GET') {
      req.query = schema.parse(req.query);
    } else {
      req.body = schema.parse(req.body);
    }
    next();
  } catch (err) {
    return res.status(400).json({ error: 'Data invalid or unsanitized', details: err.errors || err.message });
  }
};
