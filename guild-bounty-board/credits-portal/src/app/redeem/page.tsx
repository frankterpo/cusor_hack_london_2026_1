import { RedemptionForm } from '@/features/attendees/components/RedemptionForm';
import { EventMarketingHeader } from '@/components/event/EventMarketingHeader';

/** Legacy sample redeem route — prefer `/credits/event/[slug]/redeem`. */
export default function RedeemPage() {
  return (
    <div className="min-h-screen pb-16">
      <EventMarketingHeader />
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="mb-8 text-center">
          <p className="eyebrow-event">Sample flow</p>
          <h1 className="font-display mt-2 text-2xl font-semibold text-foreground">Claim your code</h1>
          <p className="mt-2 text-sm text-muted-foreground">Demo project — use event slug URLs in production.</p>
        </div>
        <div className="panel-event">
          <RedemptionForm projectId="4ULX4IY2qIMwnKe7x1LK" />
        </div>
      </div>
    </div>
  );
}
