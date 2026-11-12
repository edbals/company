import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Intro } from "./Intro";
import { stubReducedMotion } from "./test-utils";

const SEEN_KEY = "company-intro-seen";
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  stubReducedMotion(false);
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  document.body.style.overflow = "";
});

describe("landing intro", () => {
  it("renders nothing on the server and appears after mount when unseen", () => {
    expect(renderToString(<Intro />)).toBe("");
    render(<Intro />);
    expect(screen.getByTestId("company-intro")).toHaveClass("intro-blank");
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("plays again on every load, even after it was shown before", () => {
    window.sessionStorage.setItem(SEEN_KEY, "true");
    render(<Intro />);
    expect(screen.getByTestId("company-intro")).toBeInTheDocument();
  });

  it("renders with ?intro even when seen", () => {
    window.sessionStorage.setItem(SEEN_KEY, "true");
    window.history.replaceState({}, "", "/?intro");
    render(<Intro />);
    expect(screen.getByTestId("company-intro")).toBeInTheDocument();
  });

  it("Skip fades out in 200ms, remembers the session and restores scroll", () => {
    document.body.style.overflow = "scroll";
    render(<Intro />);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByTestId("company-intro")).toHaveClass("intro-skipping");
    advance(200);
    expect(screen.queryByTestId("company-intro")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("scroll");
    advance(4000);
    expect(screen.queryByTestId("company-intro")).not.toBeInTheDocument();
  });

  it.each(["Escape", "Tab", "a"])("skips on the %s key", (key) => {
    render(<Intro />);
    fireEvent.keyDown(window, { key });
    advance(200);
    expect(screen.queryByTestId("company-intro")).not.toBeInTheDocument();
  });

  it.each(["click", "wheel", "touchmove"])("skips on any %s", (event) => {
    render(<Intro />);
    fireEvent(window, new Event(event));
    advance(100);
    fireEvent(window, new Event(event));
    advance(100);
    expect(screen.queryByTestId("company-intro")).not.toBeInTheDocument();
  });

  it("does not render or mark seen with reduced motion, even for demos", () => {
    stubReducedMotion(true);
    window.history.replaceState({}, "", "/?intro");
    const onPlay = vi.fn();
    render(<Intro onPlay={onPlay} />);
    expect(screen.queryByTestId("company-intro")).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(SEEN_KEY)).toBeNull();
    expect(onPlay).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe("");
  });

  it("plays the timed sequence and glides to the measured hero avatar", () => {
    const { container } = render(
      <>
        <h1 id="hero-title">
          <span className="m-avatar" />
        </h1>
        <Intro />
      </>,
    );
    const bear = container.querySelector<HTMLElement>(".intro-bear")!;
    const target = container.querySelector(".m-avatar")!;
    vi.spyOn(bear, "getBoundingClientRect").mockReturnValue({
      left: 500,
      top: 300,
      width: 220,
      height: 220,
    } as DOMRect);
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
      left: 120,
      top: 140,
      width: 55,
      height: 55,
    } as DOMRect);

    expect(container.querySelector("video")).toBeNull();
    advance(300);
    const video = container.querySelector("video")!;
    expect(video).toHaveAttribute("src", "/avatar/company-greet.mp4");
    expect(video).toHaveAttribute("poster", "/avatar/company-poster.png");
    expect(video.muted).toBe(true);
    expect(video.autoplay).toBe(true);
    expect(video.playsInline).toBe(true);
    advance(1300);
    expect(container.querySelector(".intro-title")).toHaveClass("intro-title-visible");
    advance(700);
    expect(container.querySelector("video")).toBeNull();
    advance(700);
    expect(bear.style.transform).toBe("translate(-380px, -160px) scale(0.25, 0.25)");
    expect(screen.getByTestId("company-intro")).toHaveClass("intro-leaving");
    advance(600);
    expect(screen.queryByTestId("company-intro")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("still dismisses when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    render(<Intro />);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    advance(200);
    expect(screen.queryByTestId("company-intro")).not.toBeInTheDocument();
  });

  it("plays once in Strict Mode and cleans up on unmount", () => {
    const onPlay = vi.fn();
    const { unmount } = render(
      <StrictMode>
        <Intro onPlay={onPlay} />
      </StrictMode>,
    );
    expect(screen.getByTestId("company-intro")).toBeInTheDocument();
    expect(onPlay).toHaveBeenCalledTimes(1);
    advance(0);
    unmount();
    expect(document.body.style.overflow).toBe("");
    expect(vi.getTimerCount()).toBe(0);
  });
});
