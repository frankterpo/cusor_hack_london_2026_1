import Image from "next/image";
import Link from "next/link";

function boardBase(): string {
  const raw = (process.env.NEXT_PUBLIC_BOARD_URL || "/").replace(/\/$/, "");
  return raw || "/";
}

export function EventMarketingHeader() {
  const boardHref = boardBase();
  const judgeHref = boardHref === "/" ? "/judge" : `${boardHref}/judge`;
  const externalBoard = boardHref.startsWith("http");

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/credits" className="flex items-center gap-3 text-left transition-opacity hover:opacity-90">
          <Image
            src="/cursor-cube-briefcase.png"
            alt=""
            width={32}
            height={32}
            className="cursor-cube-luminous h-8 w-8 object-contain"
          />
          <div>
            <div className="font-display text-base font-semibold tracking-tight text-foreground">Cursor × Briefcase</div>
            <div className="text-xs text-muted-foreground">
              <span className="text-primary">London · 2026</span>
              <span className="mx-1.5 text-border">·</span>
              <span>Cursor credits</span>
            </div>
          </div>
        </Link>
        <nav className="flex flex-wrap items-center gap-2">
          {externalBoard ? (
            <a href={boardHref} className="btn-event-ghost text-xs sm:text-sm">
              Hack board
            </a>
          ) : (
            <Link href={boardHref} className="btn-event-ghost text-xs sm:text-sm">
              Hack board
            </Link>
          )}
          <a href={judgeHref} className="btn-event-ghost text-xs sm:text-sm">
            Judge portal
          </a>
        </nav>
      </div>
    </header>
  );
}
