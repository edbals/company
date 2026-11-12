import { describe, expect, it } from "vitest";
import { ELDER_ONLY_MESSAGE, assertElder, requireElder } from "./role-guard";

const fakeClient = (role: string | null) =>
  ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: role === null ? null : { role }, error: null }),
        }),
      }),
    }),
  }) as unknown as Parameters<typeof requireElder>[0];

describe("assertElder", () => {
  it("passes for the older adult's own account", () => {
    expect(() => assertElder("elder")).not.toThrow();
  });
  it("rejects a family account with the shared message", () => {
    expect(() => assertElder("family")).toThrow(ELDER_ONLY_MESSAGE);
  });
  it("rejects a missing profile", () => {
    expect(() => assertElder(undefined)).toThrow(ELDER_ONLY_MESSAGE);
  });
  it("uses a custom message when given one", () => {
    expect(() => assertElder("family", "No check-ins for family.")).toThrow(
      "No check-ins for family.",
    );
  });
});

describe("requireElder", () => {
  it("resolves when the caller's profile role is elder", async () => {
    await expect(requireElder(fakeClient("elder"), "u1")).resolves.toBeUndefined();
  });
  it("throws when the caller is family", async () => {
    await expect(requireElder(fakeClient("family"), "u1")).rejects.toThrow(ELDER_ONLY_MESSAGE);
  });
  it("throws when no profile exists", async () => {
    await expect(requireElder(fakeClient(null), "u1")).rejects.toThrow(ELDER_ONLY_MESSAGE);
  });
});
