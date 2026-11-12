import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubReducedMotion } from "../test-utils";
import { Problem } from "./Problem";

beforeEach(() => stubReducedMotion(true));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Problem", () => {
  it("is the #why section named by its heading", () => {
    const { container } = render(<Problem />);
    expect(container.querySelector("section#why")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain(
      "Wanting to go is easy.",
    );
  });

  it("includes the film and its full transcript", () => {
    render(<Problem />);
    const transcript = screen.getByRole("list", { name: "Film transcript" });
    expect(transcript.children).toHaveLength(11);
    expect(within(transcript).getByText(/Jazz with Walt on Thursday/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next" })).toBeTruthy();
  });

  it("links each research item to its source", () => {
    render(<Problem />);
    const expected: Record<string, string> = {
      "University of Michigan poll, 2024":
        "https://ihpi.umich.edu/national-poll-healthy-aging/national-findings/value-friendships-we-age",
      "Michigan Poll on Healthy Aging, 2026":
        "https://ihpi.umich.edu/national-poll-healthy-aging/michigan-findings/growing-older-michigan",
      "Cahill et al., 2009": "https://pubmed.ncbi.nlm.nih.gov/19474397/",
    };
    for (const [name, href] of Object.entries(expected)) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noreferrer");
    }
  });

  it("never uses the word demo", () => {
    const { container } = render(<Problem />);
    expect(container.textContent?.toLowerCase()).not.toContain("demo");
  });

  it("voices concrete obstacles and quiet giving-up in first person", () => {
    render(<Problem />);
    const bubbles = screen.getAllByRole("blockquote");
    expect(bubbles.map((bubble) => bubble.textContent)).toEqual([
      "“I’d love to hear some jazz with Walt. But I don’t know where to find a show, and I’d need a ride. Maybe next week.”",
      "“I’d love to help Dad see Walt. I’m texting Walt and looking for a ride for Dad, but I’m two hours away. I can’t sort it out today.”",
      "“I found a show, but I need another app to find a ride. My family’s making plans in the chat. I just wanted jazz with Walt. I’ll leave it for now.”",
    ]);
  });

  it("shows what changes for Joe as before → after", () => {
    render(<Problem />);
    expect(screen.getByRole("heading", { name: "What changes for Joe" })).toBeTruthy();
    for (const now of ["one sentence", "Maya answers one question", "Thursday, 2pm, with Walt"]) {
      expect(screen.getByText(now)).toBeTruthy();
    }
    expect(screen.getByText("eleven little jobs").tagName).toBe("S");
  });
});
