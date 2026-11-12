import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompanyAvatar, PhoneFrame, Reveal, SectionHeading } from "./primitives";

afterEach(cleanup);

describe("CompanyAvatar", () => {
  it("shows a decorative placeholder when no media is configured", () => {
    const { container } = render(<CompanyAvatar size="lg" media={null} />);
    const avatar = screen.getByTestId("company-avatar");
    expect(avatar).toHaveAttribute("aria-hidden", "true");
    expect(avatar.className).toContain("m-avatar--lg");
    expect(container.querySelector("img")).toBeNull();
  });

  it("greets once, then hands off to the calm loop", () => {
    const media = { poster: "/p.png", greet: "/greet.mp4", idle: "/idle.mp4" };
    render(<CompanyAvatar media={media} mode="greet" />);
    const greet = screen.getByTestId("company-avatar") as HTMLVideoElement;
    expect(greet.getAttribute("src")).toBe("/greet.mp4");
    expect(greet.loop).toBe(false);
    expect(greet.muted).toBe(true);
    fireEvent.ended(greet);
    const idle = screen.getByTestId("company-avatar") as HTMLVideoElement;
    expect(idle.getAttribute("src")).toBe("/idle.mp4");
    expect(idle.loop).toBe(true);
  });

  it("shows a still poster when motion is reduced", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    const media = { poster: "/p.png", greet: "/greet.mp4", idle: "/idle.mp4" };
    const { container } = render(<CompanyAvatar media={media} mode="greet" />);
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("img")).toHaveAttribute("src", "/p.png");
    vi.unstubAllGlobals();
  });
});

describe("PhoneFrame avatar", () => {
  it("uses the given avatar instead of the initial letter", () => {
    const { container } = render(
      <PhoneFrame
        label="Company phone"
        who="Company"
        avatar={<CompanyAvatar size="sm" media={null} />}
      >
        <p>Hi</p>
      </PhoneFrame>,
    );
    expect(screen.getByTestId("company-avatar")).toBeTruthy();
    expect(container.querySelector(".m-phone-avatar")).toBeNull();
  });

  it("falls back to the initial letter for people", () => {
    const { container } = render(
      <PhoneFrame label="Maya’s phone" who="Maya">
        <p>Hi</p>
      </PhoneFrame>,
    );
    expect(container.querySelector(".m-phone-avatar")?.textContent).toBe("M");
  });
});

describe("scroll reveal", () => {
  it("keeps a heading visible when it starts on screen", () => {
    const { container } = render(<SectionHeading id="t" eyebrow="E" title="Title" />);
    expect(container.querySelector(".m-section-heading")?.className).not.toContain("is-pending");
  });

  it("hides a below-the-fold block until it scrolls into view", () => {
    let fire: (visible: boolean) => void = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
          fire = (visible) => cb([{ isIntersecting: visible }]);
        }
        observe() {}
        disconnect() {}
      },
    );
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ top: 5000 } as DOMRect);
    const { container } = render(
      <Reveal>
        <p>Later</p>
      </Reveal>,
    );
    const block = container.querySelector(".m-reveal")!;
    expect(block.className).toContain("is-pending");
    act(() => fire(true));
    expect(block.className).not.toContain("is-pending");
    rect.mockRestore();
    vi.unstubAllGlobals();
  });
});
