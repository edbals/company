import { describe, expect, it } from "vitest";
import { interestsWithout, namesMentioned, redactName } from "./scrub";

describe("interestsWithout", () => {
  it("drops the setup interest a forgotten 'You enjoy …' fact came from", () => {
    expect(interestsWithout(["Jazz", "Gardening"], "You enjoy jazz")).toEqual(["Gardening"]);
  });
  it("matches whole words only", () => {
    expect(interestsWithout(["Art"], "You enjoy the party")).toEqual(["Art"]);
  });
  it("handles multi-word interests and leaves the input untouched", () => {
    const input = ["Live music", "Chess"];
    expect(interestsWithout(input, "You love live music in the afternoon")).toEqual(["Chess"]);
    expect(input).toEqual(["Live music", "Chess"]);
  });
  it("ignores regex characters in interests", () => {
    expect(interestsWithout(["C++ (coding)"], "You enjoy chess")).toEqual(["C++ (coding)"]);
  });
});

describe("namesMentioned", () => {
  it("finds a friend's name in a forgotten fact", () => {
    expect(namesMentioned(["Walt", "Ana", null], "Walt is a friend who likes jazz")).toEqual([
      "Walt",
    ]);
  });
  it("is case-insensitive and de-duplicates", () => {
    expect(namesMentioned(["walt", "Walt"], "WALT likes jazz")).toEqual(["walt"]);
  });
  it("skips names shorter than two letters", () => {
    expect(namesMentioned(["A"], "A friend")).toEqual([]);
  });
});

describe("redactName", () => {
  it("replaces every whole-word copy of the name", () => {
    expect(redactName("Going with Walt. Walt drives.", "Walt")).toBe(
      "Going with a friend. a friend drives.",
    );
  });
  it("does not touch longer words containing the name", () => {
    expect(redactName("Walter is here", "Walt")).toBe("Walter is here");
  });
});
