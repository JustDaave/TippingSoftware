import { describe, expect, it } from "vitest";
import {
  formatCents,
  isValidTipCents,
  parseCustomAmount,
  selectedTipCents,
  selectionFromCents,
  splitCents,
} from "./money";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("splitCents", () => {
  it("splits $2.00 evenly among four", () => {
    expect(splitCents(200, 4)).toEqual([50, 50, 50, 50]);
  });

  it("gives leftover cents to the first shares in order", () => {
    expect(splitCents(101, 4)).toEqual([26, 25, 25, 25]);
    expect(splitCents(4203, 4)).toEqual([1051, 1051, 1051, 1050]);
  });

  it("always adds up exactly", () => {
    for (let c = 0; c <= 2000; c++) {
      const shares = splitCents(c, 4);
      expect(sum(shares)).toBe(c);
      expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
    }
  });

  it("rejects non-integer input", () => {
    expect(() => splitCents(1.5, 4)).toThrow();
    expect(() => splitCents(100, 0)).toThrow();
  });
});

describe("parseCustomAmount", () => {
  it.each([
    ["2", 200],
    ["2.5", 250],
    ["2.50", 250],
    ["$1.01", 101],
    [" 0.50 ", 50],
    [".75", 75],
    ["100", 10000],
    ["0.29", null],
    ["", null],
    ["-1", null],
    ["abc", null],
    ["1.234", null],
    ["0", null],
    ["100.01", null],
    [".", null],
  ])("%j -> %j", (input, expected) => {
    const r = parseCustomAmount(input);
    if (expected === null) expect(r.ok).toBe(false);
    else expect(r).toEqual({ ok: true, cents: expected });
  });

  it("avoids float rounding errors", () => {
    // parseFloat("1.13") * 100 = 112.99999999999999
    expect(parseCustomAmount("1.13")).toEqual({ ok: true, cents: 113 });
    expect(parseCustomAmount("4.35")).toEqual({ ok: true, cents: 435 });
  });
});

describe("selectedTipCents", () => {
  it("returns null for no selection and No tip", () => {
    expect(selectedTipCents(null, "")).toBeNull();
    expect(selectedTipCents("none", "5")).toBeNull();
  });
  it("handles presets and custom", () => {
    expect(selectedTipCents("200", "")).toBe(200);
    expect(selectedTipCents("custom", "1.01")).toBe(101);
    expect(selectedTipCents("custom", "nope")).toBeNull();
  });
});

describe("formatCents / isValidTipCents", () => {
  it("formats", () => {
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(101)).toBe("$1.01");
    expect(formatCents(123456)).toBe("$1,234.56");
  });
  it("validates server-side amounts", () => {
    expect(isValidTipCents(200)).toBe(true);
    expect(isValidTipCents(49)).toBe(false);
    expect(isValidTipCents(2.5)).toBe(false);
    expect(isValidTipCents("200")).toBe(false);
    expect(isValidTipCents(10001)).toBe(false);
  });
});

describe("selectionFromCents", () => {
  it("restores presets", () => {
    expect(selectionFromCents(200)).toEqual({ selection: "200", customText: "" });
  });
  it("restores custom amounts as text that parses back to the same cents", () => {
    for (const cents of [50, 101, 250, 1005, 10000]) {
      const restored = selectionFromCents(cents);
      expect(restored.selection).toBe("custom");
      expect(selectedTipCents(restored.selection, restored.customText)).toBe(cents);
    }
  });
  it("restores nothing for missing or invalid amounts", () => {
    for (const cents of [null, 0, 49, 10001, 2.5, NaN]) {
      expect(selectionFromCents(cents)).toEqual({ selection: null, customText: "" });
    }
  });
});
