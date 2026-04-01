/**
 * Landing page for Cursor Credits Distribution
 * Retro pixel-art theme matching the Guild Bounty Board
 */

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: '#0b0b0b' }}>
      <div className="container mx-auto px-4 py-16">
        <main className="max-w-2xl mx-auto text-center">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-2xl md:text-3xl mb-4" style={{ color: '#3dffa3', lineHeight: '1.6' }}>
              CURSOR GUILD
            </h1>
            <p className="text-sm" style={{ color: '#aaa', fontFamily: "'Press Start 2P', monospace", lineHeight: '1.8' }}>
              CREDITS DISTRIBUTION
            </p>
          </div>

          {/* Event Card */}
          <div className="mb-8 p-8" style={{
            border: '3px solid #3dffa3',
            background: 'linear-gradient(180deg, #111 0%, #0d0d0d 100%)',
            boxShadow: '4px 4px 0 rgba(61, 255, 163, 0.15)',
          }}>
            <h2 className="text-lg mb-3" style={{ color: '#3dffa3', lineHeight: '1.6' }}>
              Cursor Hackathon London 2026
            </h2>
            <p className="mb-2" style={{ color: '#d3d3d3', fontFamily: "'VT323', monospace", fontSize: '1.3rem' }}>
              Build Eric&apos;s Software Factory
            </p>
            <p className="mb-8" style={{ color: '#888', fontFamily: "'VT323', monospace", fontSize: '1.15rem' }}>
              London &bull; April 2026
            </p>

            {/* CTA Button */}
            <a
              href="/credits/redeem"
              className="block w-full py-4 px-6 text-center text-sm transition-all duration-200 hover:opacity-85"
              style={{
                background: 'linear-gradient(180deg, #3dffa3 0%, #1db86e 100%)',
                color: '#0b0b0b',
                fontFamily: "'Press Start 2P', monospace",
                border: '3px solid #1a9957',
                boxShadow: '4px 4px 0 rgba(0, 0, 0, 0.45)',
              }}
            >
              START CODE REDEMPTION
            </a>
          </div>

          {/* Info */}
          <div style={{ color: '#888', fontFamily: "'VT323', monospace", fontSize: '1.1rem', lineHeight: '1.4' }}>
            <p className="mb-2">
              Each attendee can claim one code. You&apos;ll need your name and email address.
            </p>
            <p>
              Having trouble? Contact the event organizers for assistance.
            </p>
          </div>

          {/* Back link */}
          <div className="mt-12">
            <a
              href="/"
              className="text-xs hover:underline"
              style={{ color: '#3dffa3', fontFamily: "'Press Start 2P', monospace" }}
            >
              &larr; BACK TO BOUNTY BOARD
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}
