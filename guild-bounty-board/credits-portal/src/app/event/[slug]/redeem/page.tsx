'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { RedemptionForm } from '@/features/attendees/components/RedemptionForm';

export default function ProjectRedeemPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [project, setProject] = useState<{id: string; name: string; slug: string} | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProjectBySlug();
  }, [slug]);

  const fetchProjectBySlug = async () => {
    try {
      const response = await fetch(`/credits/api/public/projects/${slug}`);
      if (!response.ok) {
        throw new Error('Project not found');
      }
      const result = await response.json();
      setProject(result.data);
      setError('');
    } catch (err) {
      setError('Event not found or not available for redemption');
      console.error('Project fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ background: '#0b0b0b' }}>
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: '#3dffa3' }}></div>
            <p className="mt-4" style={{ color: '#888', fontFamily: "'VT323', monospace", fontSize: '1.15rem' }}>Loading event...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen" style={{ background: '#0b0b0b' }}>
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto text-center">
            <h1 className="text-xl mb-3" style={{ color: '#ff4444', lineHeight: '1.6' }}>EVENT NOT FOUND</h1>
            <p className="mb-6" style={{ color: '#d3d3d3', fontFamily: "'VT323', monospace", fontSize: '1.15rem' }}>
              {error || 'The event you\'re looking for is not available for code redemption.'}
            </p>
            <a href="/credits" className="text-xs hover:underline" style={{ color: '#3dffa3', fontFamily: "'Press Start 2P', monospace" }}>
              &larr; RETURN HOME
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#0b0b0b' }}>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-xl mb-3" style={{ color: '#3dffa3', lineHeight: '1.6' }}>
              CLAIM YOUR CODE
            </h1>
            <p style={{ color: '#d3d3d3', fontFamily: "'VT323', monospace", fontSize: '1.2rem' }}>
              {project.name}
            </p>
            <p className="mt-2" style={{ color: '#888', fontFamily: "'VT323', monospace", fontSize: '1.1rem' }}>
              Enter your details to receive your Cursor credits
            </p>
          </div>
          <RedemptionForm projectId={project.id} />
        </div>
      </div>
    </div>
  );
}
