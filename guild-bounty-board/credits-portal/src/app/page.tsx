import Link from "next/link";
import Image from "next/image";
import { EventMarketingHeader } from "@/components/event/EventMarketingHeader";

/** Credits landing — Cursor-first; hack board / judge links stay in the header. */
export default function Home() {
  return (
    <div className="min-h-screen pb-16">
      <EventMarketingHeader />

      <main className="mx-auto max-w-xl px-4 py-12 sm:px-6 sm:py-16">
        <section className="panel-event text-center">
          <div className="mx-auto mb-6 flex justify-center">
            <Image
              src="/cursor-cube-briefcase.png"
              alt="Cursor"
              width={96}
              height={96}
              className="h-24 w-24 object-contain"
              priority
            />
          </div>
          <p className="eyebrow-event">Cursor credits</p>
          <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Claim your complimentary credits
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Redeem the code issued for this event. You will confirm the name and email you registered with so we can
            match you to your Cursor benefit.
          </p>
          <Link
            href="/credits/event/cursor-hackathon-london-2026/redeem"
            className="btn-event-primary mt-8 inline-flex w-full justify-center sm:w-auto"
          >
            Start redemption
          </Link>
          <p className="mt-6 text-xs text-muted-foreground">Need help? Contact the event organizers.</p>
        </section>
      </main>
    </div>
  );
}
