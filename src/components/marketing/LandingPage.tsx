import { ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import "./landing.css";
import { SIGN_IN_PATH } from "./content";
import { Wordmark } from "./primitives";
import { Intro } from "./Intro";
import { SiteHeader } from "./SiteHeader";
import { AgentsAtWork } from "./sections/AgentsAtWork";
import { Closing } from "./sections/Closing";
import { FamilyView } from "./sections/FamilyView";
import { Faq } from "./sections/Faq";
import { Hero } from "./sections/Hero";
import { Problem } from "./sections/Problem";
import { SecondBrain } from "./sections/SecondBrain";
import { UnderTheHood } from "./sections/UnderTheHood";

const NAV_LINKS = [
  { href: "#agents", label: "How it works" },
  { href: "#second-brain", label: "Second brain" },
  { href: "#family", label: "For family" },
  { href: "#tech", label: "Under the hood" },
] as const;

export function LandingPage() {
  const [introPlayed, setIntroPlayed] = useState(false);
  const onIntroPlay = useCallback(() => setIntroPlayed(true), []);
  return (
    <div className="marketing">
      <Intro onPlay={onIntroPlay} />
      <a className="m-skip" href="#main-content">
        Skip to content
      </a>
      <SiteHeader current="home" />
      <main id="main-content" className="landing" tabIndex={-1}>
        <Hero introPlayed={introPlayed} />
        <Problem />
        <AgentsAtWork />
        <SecondBrain />
        <FamilyView />
        <UnderTheHood />
        <Faq />
        <Closing />
      </main>
      <footer className="m-footer">
        <div className="m-container">
          <div>
            <a href="/" aria-label="Company home">
              <Wordmark reverse />
            </a>
            <p className="m-footer-tagline">Keep doing what you love.</p>
          </div>
          <nav aria-label="Footer">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
            <a href="/rationale">Design Rationale</a>
            <Link to={SIGN_IN_PATH} search={{}}>
              Sign in <ArrowUpRight size={16} aria-hidden />
            </Link>
          </nav>
          <span className="m-footer-bottom">
            Company · Built around your choices. Examples on this page are illustrative.
          </span>
        </div>
      </footer>
    </div>
  );
}
