import type { ReactNode } from "react";
import { Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRevealOnScroll } from "./hooks";

export { CompanyAvatar } from "./CompanyAvatar";

interface WordmarkProps {
  reverse?: boolean;
}
export function Wordmark({ reverse = false }: WordmarkProps) {
  return (
    <img
      className="m-wordmark"
      src={reverse ? "/company-logo-reversed.svg" : "/company-logo.svg"}
      alt="Company"
      width="168"
      height="44"
    />
  );
}

interface BandProps {
  id: string;
  /** Id of the heading that names this section. */
  labelledBy: string;
  /** Dark navy "stage" band. Shared blocks inside adapt their colours automatically. */
  stage?: boolean;
  className?: string;
  children: ReactNode;
}
/** A full-width page section with the shared container inside. */
export function Band({ id, labelledBy, stage = false, className = "", children }: BandProps) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`m-band ${stage ? "m-band--stage" : ""} ${className}`.trim()}
    >
      <div className="m-container">{children}</div>
    </section>
  );
}

interface EyebrowProps {
  children: ReactNode;
  dot?: boolean;
}
export function Eyebrow({ children, dot = true }: EyebrowProps) {
  return (
    <p className="m-eyebrow">
      {dot && <span className="m-eyebrow-dot" aria-hidden />}
      {children}
    </p>
  );
}

interface SectionHeadingProps {
  /** Id placed on the h2; pass the same value to the Band's `labelledBy`. */
  id: string;
  eyebrow: string;
  title: string;
  /** Second line of the title, shown in the accent colour. */
  accent?: string;
  lead?: ReactNode;
  center?: boolean;
}
export function SectionHeading({
  id,
  eyebrow,
  title,
  accent,
  lead,
  center = false,
}: SectionHeadingProps) {
  const [ref, pending] = useRevealOnScroll<HTMLDivElement>();
  const classes = [
    "m-section-heading",
    center ? "m-section-heading--center" : "",
    pending ? "is-pending" : "",
  ];
  return (
    <div ref={ref} className={classes.filter(Boolean).join(" ")}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className="m-h2">
        {title}
        {accent && (
          <>
            {" "}
            <span>{accent}</span>
          </>
        )}
      </h2>
      {lead && <p className="m-lead">{lead}</p>}
    </div>
  );
}

interface ChipProps {
  children: ReactNode;
  Icon?: LucideIcon;
  amber?: boolean;
  className?: string;
}
export function Chip({ children, Icon, amber = false, className = "" }: ChipProps) {
  return (
    <span className={`m-chip ${amber ? "m-chip--amber" : ""} ${className}`.trim()}>
      {Icon && <Icon size={17} aria-hidden />}
      {children}
    </span>
  );
}

interface ExampleNoteProps {
  children?: ReactNode;
}
/** The honesty label every simulated block carries. */
export function ExampleNote({
  children = "Example only. Nothing here is sent, booked or saved.",
}: ExampleNoteProps) {
  return (
    <p className="m-example-note">
      <Info size={17} aria-hidden />
      <span>{children}</span>
    </p>
  );
}

interface PhoneFrameProps {
  /** Accessible name, e.g. "Joe's phone". */
  label: string;
  /** Name shown in the app header, e.g. "Company" or "Maya". */
  who: string;
  /** Replaces the initial-letter circle, e.g. with <CompanyAvatar size="sm" />. */
  avatar?: ReactNode;
  children: ReactNode;
  className?: string;
}
export function PhoneFrame({ label, who, avatar, children, className = "" }: PhoneFrameProps) {
  return (
    <div className={`m-phone ${className}`.trim()} role="group" aria-label={label}>
      <div className="m-phone-top" aria-hidden>
        <span>9:41</span>
        <span>●●●</span>
      </div>
      <div className="m-phone-who">
        {avatar ?? (
          <span className="m-phone-avatar" aria-hidden>
            {who.charAt(0)}
          </span>
        )}
        {who}
      </div>
      <div className="m-phone-body">{children}</div>
    </div>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name for the switch. */
  label: string;
}
export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="m-switch"
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

interface SegmentedOption<V extends string> {
  value: V;
  label: string;
}
interface SegmentedProps<V extends string> {
  /** Accessible name for the group. */
  label: string;
  options: readonly SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
}
export function Segmented<V extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<V>) {
  return (
    <div className="m-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface RevealProps {
  children: ReactNode;
  className?: string;
}
/** Fades its children up the first time they scroll into view. */
export function Reveal({ children, className = "" }: RevealProps) {
  const [ref, pending] = useRevealOnScroll<HTMLDivElement>();
  return (
    <div ref={ref} className={`m-reveal ${pending ? "is-pending" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}
