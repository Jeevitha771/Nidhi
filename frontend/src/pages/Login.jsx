import React, { useState, useEffect } from 'react';
import { Database, Shield } from 'lucide-react';
import { Logo } from '../components/Logo';
import { ThemeToggle } from '../contexts/ThemeContext';

const Login = () => {
  const [environment, setEnvironment] = useState('');
  const [username, setUsername] = useState('jeevitha');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/nidhi-api/env/')
      .then(r => r.json())
      .then(d => setEnvironment(d.environment || ''))
      .catch(() => setEnvironment(''));
  }, []);

  const handleLocalLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/nidhi-api/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('sso_token', data.token);
        localStorage.setItem('user_role', data.role);
        localStorage.setItem('sso_username', data.username);
        window.location.href = '/dashboard';
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error during login.');
    } finally {
      setLoading(false);
    }
  };

  const handleSsoLogin = () => {
    const clientId = process.env.REACT_APP_RUBIX_CLIENT_ID || 'nidhi_client_id_123';
    const baseUri = window.location.origin + (window.location.pathname.startsWith('/nidhi') ? '/nidhi' : '');
    const defaultCallback = `${baseUri}/auth/callback`;
    const redirectUri = encodeURIComponent(process.env.REACT_APP_RUBIX_REDIRECT_URI || defaultCallback);
    const rubixAuthUrl = `https://rubix.novamymentor.cloud/o/authorize/?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;
    window.location.href = rubixAuthUrl;
  };

  const isNexus = environment.toLowerCase() === 'nexusserver';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen relative bg-slate-50 dark:bg-slate-900">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="relative z-10 max-w-md w-full mx-4">
        <div className="w-full p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
          <div className="flex flex-col items-center mb-8">
            <Logo className="mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Sign In</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-center">
              {isNexus ? 'Local control-plane access' : 'Authenticate via Rubix IT to access the Control Plane'}
            </p>
          </div>

          {isNexus ? (
            <form onSubmit={handleLocalLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white py-3 px-4 rounded-xl font-medium transition-all disabled:opacity-60"
              >
                <Shield className="w-5 h-5 text-[#98FF98]" />
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <button
              onClick={handleSsoLogin}
              className="w-full flex items-center justify-center gap-3 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white py-3 px-4 rounded-xl font-medium transition-all"
            >
              <Shield className="w-5 h-5 text-[#98FF98]" />
              Login with Rubix SSO
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
