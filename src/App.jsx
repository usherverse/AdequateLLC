/**
 * App.jsx — Root application shell
 *
 * This file is intentionally thin. All actual UI lives in lms-core.jsx
 * (the production-refactored monolith). App.jsx:
 *  1. Reads auth state from AuthContext
 *  2. Shows a full-screen loader while session is resolving
 *  3. Delegates rendering to the LMS core App component
 *
 * The LMS core handles its own routing (admin-login / admin / worker modes)
 * and will automatically integrate Supabase auth when credentials are present.
 */
import { useAuth } from '@/context/AuthContext';
import LMSApp from '@/lms-core';

// Full-screen loading spinner shown while Supabase resolves the session
function AppLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#080C14', flexDirection: 'column', gap: 16,
    }}>
      <div style={{
        width: 40, height: 40, border: '3px solid #1E2D45',
        borderTop: '3px solid #00D4AA', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ color: '#475569', fontSize: 13, fontFamily: 'system-ui' }}>
        Loading…
      </div>
    </div>
  );
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return <AppLoader />;
  return <LMSApp />;
}
