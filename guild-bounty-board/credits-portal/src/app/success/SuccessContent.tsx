'use client';

import { useSearchParams } from 'next/navigation';
import { ExternalLink } from 'lucide-react';

export function SuccessContent() {
  const searchParams = useSearchParams();
  const cursorUrl = searchParams.get('cursorUrl') || 'https://cursor.com/referral?code=SAMPLE-CODE';
  const name = searchParams.get('name') || 'Attendee';

  return (
    <div className="min-h-screen" style={{ background: '#0b0b0b' }}>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <div className="mx-auto w-20 h-20 flex items-center justify-center mb-6" style={{
              border: '3px solid #3dffa3',
              borderRadius: '50%',
              background: 'rgba(61, 255, 163, 0.1)',
            }}>
              <span style={{ color: '#3dffa3', fontSize: '2.5rem' }}>+</span>
            </div>
            <h1 className="text-xl mb-3" style={{ color: '#3dffa3', lineHeight: '1.6' }}>
              SUCCESS, {name.toUpperCase()}!
            </h1>
            <p style={{ color: '#d3d3d3', fontFamily: "'VT323', monospace", fontSize: '1.3rem' }}>
              Your Cursor credits are ready to claim
            </p>
          </div>

          <div className="mb-8 p-8 text-center" style={{
            border: '3px solid #3dffa3',
            background: '#111',
            boxShadow: '4px 4px 0 rgba(61, 255, 163, 0.15)',
          }}>
            <button
              onClick={() => window.open(cursorUrl, '_blank')}
              className="w-full py-5 px-6 text-sm transition-all duration-200 hover:opacity-85 flex items-center justify-center gap-3"
              style={{
                background: 'linear-gradient(180deg, #3dffa3 0%, #1db86e 100%)',
                color: '#0b0b0b',
                fontFamily: "'Press Start 2P', monospace",
                border: '3px solid #1a9957',
                boxShadow: '4px 4px 0 rgba(0, 0, 0, 0.45)',
              }}
            >
              <ExternalLink className="w-5 h-5" />
              CLAIM YOUR CREDITS NOW
            </button>

            <p className="mt-6" style={{ color: '#888', fontFamily: "'VT323', monospace", fontSize: '1.1rem' }}>
              Click above to open Cursor and automatically apply your credits
            </p>
          </div>

          <div className="text-center">
            <p style={{ color: '#666', fontFamily: "'VT323', monospace", fontSize: '1rem' }}>
              Need help? Contact the event organizers
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
