import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
import { FamilyView, familyReducer, INITIAL_FAMILY_STATE } from "./FamilyView";

beforeEach(() => stubReducedMotion(true));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const feed = () => screen.getByTestId("family-feed");

describe("familyReducer", () => {
  it("toggles one share without touching the others", () => {
    const next = familyReducer(INITIAL_FAMILY_STATE, {
      type: "share",
      key: "errands",
      value: true,
    });
    expect(next.shares).toEqual({ plans: true, errands: true, outings: false });
    expect(INITIAL_FAMILY_STATE.shares.errands).toBe(false);
  });

  it("sends a request, records the answer and resets", () => {
    const sent = familyReducer(INITIAL_FAMILY_STATE, { type: "send" });
    expect(sent.request).toBe("sent");
    const answered = familyReducer(sent, { type: "answer", answer: "yes" });
    expect(answered.request).toBe("yes");
    expect(familyReducer(answered, { type: "reset" })).toEqual(INITIAL_FAMILY_STATE);
  });

  it("ignores an answer when no request is waiting", () => {
    expect(familyReducer(INITIAL_FAMILY_STATE, { type: "answer", answer: "no" })).toBe(
      INITIAL_FAMILY_STATE,
    );
  });
});

describe("FamilyView", () => {
  it("shows only the plan line by default", () => {
    render(<FamilyView />);
    expect(within(feed()).getByText(/Joe is planning: Jazz at the Lakeside Café/)).toBeTruthy();
    expect(within(feed()).queryByText(/milk and bread/)).toBeNull();
  });

  it("adds the errand line when errands are shared", () => {
    render(<FamilyView />);
    fireEvent.click(screen.getByRole("switch", { name: "Share my errands" }));
    expect(within(feed()).getByText("Joe needs milk and bread by tomorrow")).toBeTruthy();
  });

  it("says nothing is shared when every switch is off", () => {
    render(<FamilyView />);
    fireEvent.click(screen.getByRole("switch", { name: "Share my plans" }));
    expect(within(feed()).getByText("Nothing shared right now.")).toBeTruthy();
  });

  it("marks conversations and memory as never shared", () => {
    render(<FamilyView />);
    expect(screen.getAllByText("Never shared")).toHaveLength(2);
  });

  it("sends a request, lets Maya say yes and removes the buttons", () => {
    render(<FamilyView />);
    fireEvent.click(screen.getByRole("button", { name: "Ask Maya for a lift on Thursday" }));
    expect(screen.getByText("Request sent to Maya")).toBeTruthy();
    expect(screen.getByText(/Joe asks: “Can you drive me on Thursday/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Yes, I can" }));
    expect(screen.getByText("Maya said yes")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Yes, I can" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Can’t make it" })).toBeNull();
  });

  it("shows the decline message", () => {
    render(<FamilyView />);
    fireEvent.click(screen.getByRole("button", { name: "Ask Maya for a lift on Thursday" }));
    fireEvent.click(screen.getByRole("button", { name: "Can’t make it" }));
    expect(screen.getByText(/Maya can’t make it. Company will offer other options./)).toBeTruthy();
  });

  it("restores the starting state on reset", () => {
    render(<FamilyView />);
    fireEvent.click(screen.getByRole("switch", { name: "Share my outings" }));
    fireEvent.click(screen.getByRole("button", { name: "Ask Maya for a lift on Thursday" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset example" }));
    expect(screen.queryByText("Request sent to Maya")).toBeNull();
    expect(within(feed()).queryByText(/went to the jazz/)).toBeNull();
    expect(screen.getByRole("switch", { name: "Share my outings" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("is labelled by its heading and carries the example note", () => {
    render(<FamilyView />);
    expect(document.getElementById("family")).toHaveAttribute("aria-labelledby", "family-title");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain("Family helps.");
    expect(screen.getByText(/Nothing here is sent, booked or saved/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/demo/i);
  });
  it("animates the line between the phones only while a request is on its way", () => {
    const { container } = render(<FamilyView />);
    const line = () => container.querySelector(".family-connector")!;
    expect(line().className).not.toContain("is-flowing");
    fireEvent.click(screen.getByRole("button", { name: "Ask Maya for a lift on Thursday" }));
    expect(line().className).toContain("is-flowing");
    fireEvent.click(screen.getByRole("button", { name: "Yes, I can" }));
    expect(line().className).not.toContain("is-flowing");
  });
});
