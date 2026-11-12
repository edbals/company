// Browser mocks only: these check the recorder's state machine, not a real microphone or speaker.
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/voice.functions", () => ({ voiceStatus: vi.fn(async () => ({ ready: false, reason: "setup_needed", recorded: null, company: null, narrator: null })) }));

import { useRecorder } from "./use-voice";
import { play, stopAudio } from "@/lib/voice-client";

type FakeRec = { onresult: ((e: unknown) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void; abort: () => void };
let recs: FakeRec[] = [];
const said = (rec: FakeRec, text: string, isFinal = false) =>
  rec.onresult?.({ results: [Object.assign([{ transcript: text }], { isFinal })] });

class FakeMediaRecorder {
  static isTypeSupported = () => true;
  state = "inactive"; mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null; onstop: (() => void) | null = null;
  start() { this.state = "recording"; }
  stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob([new Uint8Array(4000)], { type: "audio/webm" }) }); setTimeout(() => this.onstop?.(), 0); }
}

beforeEach(() => {
  recs = [];
  class R implements FakeRec {
    onresult: FakeRec["onresult"] = null; onend: FakeRec["onend"] = null; onerror: FakeRec["onerror"] = null; lang = ""; interimResults = false; continuous = false;
    constructor() { recs.push(this); }
    start() {} stop() { setTimeout(() => this.onend?.(), 5); } abort() {}
  }
  Object.assign(window, { SpeechRecognition: R, MediaRecorder: FakeMediaRecorder });
  Object.assign(globalThis, { MediaRecorder: FakeMediaRecorder });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop() {}, onended: null }] })) } });
});

describe("recorder", () => {
  it("a cancelled recording's late words never reach the next one", async () => {
    const onFinal = vi.fn();
    const { result } = renderHook(() => useRecorder({ transcribe: null, onFinal }));
    await act(async () => { await result.current.start(); });
    const a = recs[0]!;
    act(() => result.current.cancel());
    await act(async () => { await result.current.start(); });
    const b = recs[1]!;
    act(() => said(a, "words from the first try"));
    expect(result.current.interim).toBe("");
    act(() => said(b, "I need milk", true));
    await act(async () => { await result.current.stop(); });
    expect(onFinal).toHaveBeenCalledWith("I need milk");
  });

  it("stop waits for the final words instead of returning stale interim text", async () => {
    const onFinal = vi.fn();
    const { result } = renderHook(() => useRecorder({ transcribe: null, onFinal }));
    await act(async () => { await result.current.start(); });
    const r = recs[0]!;
    act(() => said(r, "I need"));
    r.stop = () => { setTimeout(() => { said(r, "I need milk", true); r.onend?.(); }, 20); };
    await act(async () => { await result.current.stop(); });
    expect(onFinal).toHaveBeenCalledWith("I need milk");
  });

  it("server transcription wins when available; nothing is sent automatically", async () => {
    const onFinal = vi.fn();
    const transcribe = vi.fn(async () => "I'd love some jazz");
    const { result } = renderHook(() => useRecorder({ transcribe, onFinal }));
    await act(async () => { await result.current.start(); });
    act(() => said(recs[0]!, "I love sam jazz"));
    await act(async () => { await result.current.stop(); });
    expect(transcribe).toHaveBeenCalledOnce();
    expect(onFinal).toHaveBeenCalledWith("I'd love some jazz");
    expect(result.current.state).toBe("idle");
  });

  it("a blocked microphone says so plainly", async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new DOMException("no", "NotAllowedError"));
    const { result } = renderHook(() => useRecorder({ transcribe: null, onFinal: vi.fn() }));
    await act(async () => { await result.current.start(); });
    expect(result.current.state).toBe("error");
    expect(result.current.error).toMatch(/blocked/);
  });

  it("no speech gives a retry message, not an empty send", async () => {
    const onFinal = vi.fn();
    const { result } = renderHook(() => useRecorder({ transcribe: async () => null, onFinal }));
    await act(async () => { await result.current.start(); });
    await act(async () => { await result.current.stop(); });
    expect(onFinal).not.toHaveBeenCalled();
    expect(result.current.state).toBe("error");
  });
});

describe("player", () => {
  it("starting a new clip cancels the one before (no overlap)", async () => {
    const first = play("a", () => new Promise(() => undefined));
    const second = play("b", async () => null);
    expect(await first).toBe("cancelled");
    expect(await second).toBe("unavailable");
    stopAudio();
  });
});
