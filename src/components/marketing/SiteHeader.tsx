import { ArrowUpRight } from "lucide-react";
import { DEMO_PATH } from "./content";
import { Wordmark } from "./primitives";

export type SitePage = "home" | "rationale" | "demo";

interface NavItem {
  page: SitePage;
  href: string;
  label: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { page: "home", href: "/", label: "Home" },
  { page: "rationale", href: "/rationale", label: "Design Rationale" },
] as const;

interface SiteHeaderProps {
  current: SitePage;
}

/** The one sticky navbar shared by every marketing page, so pages can't drift apart. */
export function SiteHeader({ current }: SiteHeaderProps) {
  return (
    <header className="m-nav-bar">
      <div className="m-nav m-container">
        <a href="/" aria-label="Company home">
          <Wordmark />
        </a>
        <nav aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.page}
              className={`m-nav-link m-nav-link--${item.page}`}
              href={item.href}
              aria-current={item.page === current ? "page" : undefined}
            >
              {item.label}
            </a>
          ))}
          <a className="m-button m-button--dark m-button--small m-nav-cta" href={DEMO_PATH}>
            Try demo <ArrowUpRight size={18} aria-hidden />
          </a>
        </nav>
      </div>
    </header>
  );
}
