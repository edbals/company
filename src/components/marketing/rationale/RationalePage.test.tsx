import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    search: _search,
    ...props
  }: {
    to: string;
    children: ReactNode;
    search?: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
import { stubReducedMotion } from "../test-utils";
import { RationalePage } from "./RationalePage";

// The team's own sentences, word for word (some whole sentences removed, none reworded).
const SOURCE = [
  "Why We're Building Company",
  "AI Planning for Older Adults",
  "1. The Problem: When Small Obstacles Get in the Way of Living",
  "An afternoon listening to jazz might mean finding a show, arranging a ride, checking schedules, and asking someone for help.",
  "Together, they can be enough to make staying home feel easier than going out.",
  "We believe getting older shouldn't mean having to choose between doing what you love and maintaining your independence.",
  "2. Our Target Users: Independence for Older Adults, Peace of Mind for Families",
  "Much of the technology designed for older adults focuses on what might go wrong: missed medication, falls, emergencies, or keeping family informed.",
  "Instead of asking what an older adult needs help with, what if we simply asked what they'd love to do?",
  "Our primary users are older adults who want to continue enjoying their lives, but face growing difficulties in making everyday plans. They want the freedom to make their own decisions without feeling like a burden.",
  "They want to know their loved ones are doing well and be there when needed, without becoming responsible for organising every part of their lives.",
  "3. Our Solution: Make the Complicated Feel Simple",
  "Company is an AI companion that helps older adults turn everyday wishes into plans they can actually follow through on.",
  "We designed the experience around three steps: Tell Company. Company makes a plan. You decide.",
  "People can speak or type naturally, without learning complicated commands or navigating multiple apps. Behind one conversation, specialised AI agents work together to find events, figure out transportation, check schedules, and coordinate with others when needed.",
  "4. Key Interaction Choices: Help Without Taking Over",
  "Conversation over complexity. Voice interaction, large controls, familiar language, and one question at a time make the experience easier to navigate.",
  "Human control at every step. Company separates planning from taking action. Important decisions require clear approval, with costs and consequences explained beforehand.",
  "Privacy by choice. People decide what their family can see and what Company remembers.",
  "Help that adapts. When something changes, such as a cancelled ride, Company helps find alternatives instead of leaving the person to start over.",
  "Complexity beneath the surface. Specialised AI agents handle the coordination, while users see a simple experience.",
  "The AI does the legwork. The person stays in charge.",
  "5. The Outcome: More Life, Less Logistics",
  "We're building something that makes it easier to say yes to life. Another afternoon with friends. Another concert. Another reason to get out of the house.",
  "Because the best thing technology can do isn't give us more to manage. It's make more room for living.",
] as const;

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

beforeEach(() => stubReducedMotion(true));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Design rationale page", () => {
  it("shows every line of the approved text, word for word", () => {
    const { container } = render(<RationalePage />);
    // Screen-reader-only copies of the three steps are excluded so each line is checked once.
    const decorative = container.querySelectorAll("[aria-hidden='true'], [aria-hidden]");
    decorative.forEach((node) => node.remove());
    const page = normalize(container.textContent ?? "");
    for (const line of SOURCE) expect(page).toContain(line);
  });

  it("has one h1 and five numbered section headings", () => {
    render(<RationalePage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Why We're Building Company",
    );
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(5);
  });

  it("links back to the main page and to the demo", () => {
    render(<RationalePage />);
    expect(screen.getByRole("link", { name: /Back to Company/ })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /Try demo/ })).toHaveAttribute("href", "/demo");
  });

  it("introduces three personas with portraits and an honest note", () => {
    render(<RationalePage />);
    for (const name of ["Joe, 78", "Maya, 46", "Elena, 71"]) {
      expect(screen.getByRole("heading", { level: 3, name })).toBeTruthy();
    }
    const portraits = document.querySelectorAll(".why-persona-portrait img");
    expect(portraits).toHaveLength(3);
    expect(screen.getByText(/illustrative composites, not research participants/)).toBeTruthy();
  });

  it("never claims Company books rides or tickets", () => {
    const { container } = render(<RationalePage />);
    expect(container.textContent).not.toMatch(/reserves|books (a|the|rides)|booked a|tickets/i);
  });
});
