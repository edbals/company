import { beforeEach, describe, expect, it, vi } from "vitest";
import { askModel } from "./ai-model.server";
import { prepareAgentDraft } from "./planning-agents.server";

vi.mock("./ai-model.server", () => ({ askModel: vi.fn() }));
const model = vi.mocked(askModel);
const words = "I'd like to see jazz and ask family for a ride.";
const checkin = { reply: "I found an option.", eventIds: ["jazz"] };
const events = [
  { id: "jazz", title: "Jazz", place: "Library", starts_at: "2026-11-20T14:00:00Z" },
  { id: "other", title: "Other", place: "Park", starts_at: "2026-11-20T15:00:00Z" },
];

describe("planning agent handoffs", () => {
  beforeEach(() => model.mockReset());

  it("passes specialist choices to Coordinator and returns its validated draft", async () => {
    const draft = { eventId: "jazz", ride: "family", family: "ride" };
    model.mockResolvedValueOnce({ eventId: "jazz" }).mockResolvedValueOnce({ ride: "family" })
      .mockResolvedValueOnce({ family: "ride" }).mockResolvedValueOnce(draft);
    await expect(prepareAgentDraft(words, checkin, events)).resolves.toEqual(draft);
    expect(model).toHaveBeenNthCalledWith(4, expect.stringContaining("Coordinator"),
      expect.objectContaining({ options: draft, event: events[0] }));
  });

  it("ignores a failed specialist and prevents Coordinator from adding choices", async () => {
    model.mockResolvedValueOnce({ eventId: "other" }).mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ family: "ride" })
      .mockResolvedValueOnce({ eventId: "other", ride: "own_way", family: "invite" });
    await expect(prepareAgentDraft(words, checkin, events)).resolves.toEqual({
      eventId: null, ride: "undecided", family: "none",
    });
  });
});
