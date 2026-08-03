import { describe, expect, it } from "vitest";
import { prepareTextFile } from "./generate-file";

describe("prepareTextFile", () => {
  it("accepts a normal filename and content, trimming the filename", () => {
    const result = prepareTextFile("  pricing-memo.txt  ", "Our prices are...");
    expect(result).toEqual({
      filename: "pricing-memo.txt",
      content: "Our prices are...",
    });
  });

  it("rejects filenames with path separators or traversal shapes", () => {
    expect(() => prepareTextFile("../etc/passwd", "x")).toThrow(/filename/i);
    expect(() => prepareTextFile("folder/name.txt", "x")).toThrow(/filename/i);
  });

  it("rejects an empty or all-whitespace filename", () => {
    expect(() => prepareTextFile("", "x")).toThrow(/filename/i);
    expect(() => prepareTextFile("   ", "x")).toThrow(/filename/i);
  });

  it("rejects empty or all-whitespace content", () => {
    expect(() => prepareTextFile("notes.txt", "")).toThrow(/content/i);
    expect(() => prepareTextFile("notes.txt", "   ")).toThrow(/content/i);
  });

  it("truncates content past the max length", () => {
    const huge = "a".repeat(25_000);
    const result = prepareTextFile("big.txt", huge);
    expect(result.content).toHaveLength(20_000);
  });
});
