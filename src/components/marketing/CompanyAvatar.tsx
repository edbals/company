import { useState } from "react";
import { COMPANY_AVATAR } from "./content";
import type { AvatarMedia } from "./content";
import { usePrefersReducedMotion } from "./hooks";
import "./avatar.css";

type AvatarSize = "sm" | "md" | "lg" | "inline";
/** "greet" plays the greeting once, then loops idle. Use it in one place only (the hero). */
type AvatarMode = "greet" | "idle";

interface CompanyAvatarProps {
  size?: AvatarSize;
  mode?: AvatarMode;
  /** Overrides the configured media, mainly for tests. */
  media?: AvatarMedia | null;
  className?: string;
}

/**
 * Company's character. Decorative: the name "Company" always appears in text nearby.
 * Reduced motion shows a still poster. With no media configured, a soft placeholder circle.
 */
export function CompanyAvatar({
  size = "md",
  mode = "idle",
  media = COMPANY_AVATAR,
  className = "",
}: CompanyAvatarProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [greetingEnded, setGreetingEnded] = useState(false);
  const greeted = mode === "idle" || greetingEnded;
  const classes = `m-avatar m-avatar--${size} ${className}`.trim();

  if (!media) {
    return (
      <span
        className={`${classes} m-avatar--placeholder`}
        aria-hidden
        data-testid="company-avatar"
      />
    );
  }
  if (reducedMotion) {
    return (
      <img
        className={`${classes} m-avatar--media`}
        src={media.poster}
        alt=""
        aria-hidden
        data-testid="company-avatar"
      />
    );
  }
  return (
    <video
      key={greeted ? "idle" : "greet"}
      className={`${classes} m-avatar--media`}
      src={greeted ? media.idle : media.greet}
      poster={media.poster}
      autoPlay
      muted
      playsInline
      loop={greeted}
      preload="auto"
      aria-hidden
      tabIndex={-1}
      data-testid="company-avatar"
      onEnded={() => setGreetingEnded(true)}
    />
  );
}
