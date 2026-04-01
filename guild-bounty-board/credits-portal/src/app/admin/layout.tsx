'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface SelectedProject {
  id: string;
  name: string;
  slug: string;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedProject, setSelectedProject] = useState<SelectedProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = () => {
      const authenticated = localStorage.getItem('admin_authenticated') === 'true';
      setIsAuthenticated(authenticated);

      const projectData = localStorage.getItem('admin_selected_project');
      if (projectData) {
        try {
          setSelectedProject(JSON.parse(projectData));
        } catch {
          localStorage.removeItem('admin_selected_project');
          setSelectedProject(null);
        }
      }

      setIsLoading(false);

      if (!authenticated && pathname !== '/credits/admin') {
        router.push('/credits/admin');
      } else if (authenticated && !projectData && pathname !== '/credits/admin' && pathname !== '/credits/admin/projects') {
        router.push('/credits/admin/projects');
      }
    };

    checkAuth();
  }, [router, pathname]);

  const handleLogout = () => {
    localStorage.removeItem('admin_authenticated');
    localStorage.removeItem('admin_selected_project');
    setIsAuthenticated(false);
    setSelectedProject(null);
    router.push('/credits/admin');
  };

  const handleProjectSwitch = () => {
    router.push('/credits/admin/projects');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b0b0b' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: '#3dffa3' }}></div>
          <p className="mt-4" style={{ color: '#888', fontFamily: "'VT323', monospace", fontSize: '1.15rem' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || pathname === '/credits/admin') {
    return children;
  }

  if (pathname === '/credits/admin/projects') {
    return children;
  }

  if (!selectedProject) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b0b0b' }}>
        <div className="text-center">
          <h2 className="text-sm mb-4" style={{ color: '#3dffa3', fontFamily: "'Press Start 2P', monospace", lineHeight: '1.6' }}>NO PROJECT SELECTED</h2>
          <p className="mb-6" style={{ color: '#d3d3d3', fontFamily: "'VT323', monospace", fontSize: '1.15rem' }}>Please select a project to continue.</p>
          <button
            onClick={handleProjectSwitch}
            className="py-3 px-6 text-xs hover:opacity-85"
            style={{
              background: 'linear-gradient(180deg, #3dffa3 0%, #1db86e 100%)',
              color: '#0b0b0b',
              fontFamily: "'Press Start 2P', monospace",
              border: '3px solid #1a9957',
              boxShadow: '4px 4px 0 rgba(0, 0, 0, 0.45)',
            }}
          >
            SELECT PROJECT
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#0b0b0b' }}>
      {/* Header */}
      <header style={{ background: '#111', borderBottom: '3px solid #3dffa3' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-xs" style={{ color: '#3dffa3', fontFamily: "'Press Start 2P', monospace" }}>
                  CREDITS ADMIN
                </h1>
                {selectedProject && (
                  <p className="mt-1" style={{ color: '#888', fontFamily: "'VT323', monospace", fontSize: '1rem' }}>
                    {selectedProject.name}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {['Switch Project', 'View Public Site', 'Logout'].map((label) => (
                <button
                  key={label}
                  onClick={() => {
                    if (label === 'Switch Project') handleProjectSwitch();
                    else if (label === 'View Public Site') router.push(`/credits/event/${selectedProject.slug}/redeem`);
                    else handleLogout();
                  }}
                  className="py-1 px-3 text-xs hover:opacity-85"
                  style={{
                    border: '2px solid #3dffa3',
                    color: '#3dffa3',
                    background: 'transparent',
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: '0.55rem',
                  }}
                >
                  {label.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav style={{ background: '#111', borderBottom: '2px solid #222' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { href: '/credits/admin/dashboard', label: 'Dashboard' },
              { href: '/credits/admin/codes', label: 'Codes' },
              { href: '/credits/admin/attendees', label: 'Attendees' },
              { href: '/credits/admin/uploads', label: 'Upload Data' },
            ].map(({ href, label }) => (
              <button
                key={href}
                onClick={() => router.push(href)}
                className="py-3 px-1 transition-colors"
                style={{
                  borderBottom: pathname === href ? '2px solid #3dffa3' : '2px solid transparent',
                  color: pathname === href ? '#3dffa3' : '#888',
                  fontFamily: "'VT323', monospace",
                  fontSize: '1.15rem',
                  background: 'transparent',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
