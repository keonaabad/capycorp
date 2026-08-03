import { describe, expect, it } from "vitest";
import { calculate } from "./calculator";

describe("calculate", () => {
  it("evaluates basic arithmetic", () => {
    expect(calculate("2 + 2")).toBe(4);
    expect(calculate("10 - 3")).toBe(7);
    expect(calculate("6 * 7")).toBe(42);
    expect(calculate("10 / 4")).toBe(2.5);
    expect(calculate("10 % 3")).toBe(1);
  });

  it("respects operator precedence and parentheses", () => {
    expect(calculate("2 + 3 * 4")).toBe(14);
    expect(calculate("(2 + 3) * 4")).toBe(20);
    expect(calculate("2 * (3 + (4 - 1))")).toBe(12);
  });

  it("handles unary sign", () => {
    expect(calculate("-5 + 10")).toBe(5);
    expect(calculate("-(3 + 2)")).toBe(-5);
    expect(calculate("5 - -3")).toBe(8);
  });

  it("handles decimals and rounds away float noise", () => {
    expect(calculate("0.1 + 0.2")).toBe(0.3);
    expect(calculate("1.5 * 2")).toBe(3);
  });

  it("throws on division by zero", () => {
    expect(() => calculate("5 / 0")).toThrow(/division by zero/i);
    expect(() => calculate("5 % 0")).toThrow(/division by zero/i);
  });

  it("throws on empty input", () => {
    expect(() => calculate("")).toThrow(/empty/i);
    expect(() => calculate("   ")).toThrow(/empty/i);
  });

  it("throws on unbalanced parentheses", () => {
    expect(() => calculate("(2 + 3")).toThrow();
    expect(() => calculate("2 + 3)")).toThrow();
  });

  it("throws on trailing garbage after a valid expression", () => {
    expect(() => calculate("2 + 2 2")).toThrow(/trailing/i);
  });

  it("throws on malformed numbers", () => {
    expect(() => calculate("2..5 + 1")).toThrow();
  });

  it("throws instead of executing arbitrary code for injection-shaped input", () => {
    expect(() => calculate("process.exit()")).toThrow();
    expect(() => calculate("require('fs')")).toThrow();
    expect(() => calculate("1; DROP TABLE users;")).toThrow();
  });
});
