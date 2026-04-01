'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('admin_authenticated') === 'true';
    if (isAuthenticated) {
      const selectedProject = localStorage.getItem('admin_selected_project');
      if (selectedProject) {
        router.push('/credits/admin/dashboard');
      } else {
        router.push('/credits/admin/projects');
      }
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/credits/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const result = await response.json();

      if (result.success) {
        localStorage.setItem('admin_authenticated', 'true');
        router.push('/credits/admin/projects');
      } else {
        setError('Invalid password');
      }
    } catch {
      setError('Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0b0b0b' }}>
      <div className="w-full max-w-md p-8" style={{
        border: '3px solid #3dffa3',
        background: '#111',
        boxShadow: '4px 4px 0 rgba(61, 255, 163, 0.15)',
      }}>
        <h2 className="text-lg mb-2 text-center" style={{ color: '#3dffa3', lineHeight: '1.6' }}>
          ADMIN ACCESS
        </h2>
        <p className="text-center mb-6" style={{ color: '#888', fontFamily: "'VT323', monospace", fontSize: '1.15rem' }}>
          Enter the admin password to access the dashboard
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block mb-2 text-xs" style={{ color: '#3dffa3', fontFamily: "'Press Start 2P', monospace" }}>
              PASSWORD
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              required
              autoFocus
              className="w-full px-4 py-3"
              style={{
                background: '#0b0b0b',
                border: '2px solid #333',
                color: '#e0e0e0',
                fontFamily: "'VT323', monospace",
                fontSize: '1.15rem',
              }}
            />
          </div>

          {error && (
            <div className="p-3 text-center" style={{
              background: 'rgba(255, 68, 68, 0.1)',
              border: '2px solid #ff4444',
              color: '#ff4444',
              fontFamily: "'VT323', monospace",
              fontSize: '1.1rem',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !password.trim()}
            className="w-full py-3 px-6 text-sm transition-all duration-200 hover:opacity-85 disabled:opacity-50"
            style={{
              background: 'linear-gradient(180deg, #3dffa3 0%, #1db86e 100%)',
              color: '#0b0b0b',
              fontFamily: "'Press Start 2P', monospace",
              border: '3px solid #1a9957',
              boxShadow: '4px 4px 0 rgba(0, 0, 0, 0.45)',
            }}
          >
            {isLoading ? 'AUTHENTICATING...' : 'ACCESS DASHBOARD'}
          </button>
        </form>
      </div>
    </div>
  );
}
