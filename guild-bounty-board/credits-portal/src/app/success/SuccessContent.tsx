'use client';

import { useSearchParams } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { EventMarketingHeader } from '@/components/event/EventMarketingHeader';

export function SuccessContent() {
  const searchParams = useSearchParams();
  const cursorUrl = searchParams.get('cursorUrl') || 'https://cursor.com/referral?code=SAMPLE-CODE';
  const name = searchParams.get('name') || 'Attendee';

  return (
    <div className="min-h-screen pb-16">
      <EventMarketingHeader />
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary/60 bg-primary/10">
            <span className="text-3xl font-semibold text-primary">✓</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-foreground">You&apos;re set, {name}!</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your Cursor credits link is ready.</p>
        </div>

        <div className="panel-event text-center">
          <button
            type="button"
            onClick={() => window.open(cursorUrl, '_blank', 'noopener,noreferrer')}
            className="btn-event-primary inline-flex w-full items-center justify-center gap-2 py-4 text-sm font-semibold"
          >
            <ExternalLink className="h-5 w-5" />
            Open Cursor — claim credits
          </button>
          <p className="mt-6 text-xs text-muted-foreground">
            Opens Cursor with your referral link. Need help? Contact the organizers.
          </p>
        </div>

        <p className="mt-8 text-center text-sm">
          <Link href="/credits" className="text-primary hover:underline">
            ← Back to credits home
          </Link>
        </p>
      </div>
    </div>
  );
}
