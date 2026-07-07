import { describe, expect, it } from "vitest";
import {
  buildHeadingIds,
  isInternalMarkdownLink,
  parseMarkdownNavigationTarget
} from "./markdown";

describe("markdown link helpers", () => {
  it("treats markdown links with hashes and queries as internal documents", () => {
    expect(isInternalMarkdownLink("guide/intro.md")).toBe(true);
    expect(isInternalMarkdownLink("guide/intro.md#overview")).toBe(true);
    expect(isInternalMarkdownLink("guide/intro.md?plain=1#overview")).toBe(true);
    expect(isInternalMarkdownLink("#overview")).toBe(false);
    expect(isInternalMarkdownLink("https://example.com/guide/intro.md#overview")).toBe(false);
  });

  it("splits a markdown navigation target without breaking file loading", () => {
    expect(parseMarkdownNavigationTarget("guide/intro.md#overview")).toEqual({
      path: "guide/intro.md",
      anchor: "overview"
    });
    expect(parseMarkdownNavigationTarget("guide/intro.md?plain=1#overview")).toEqual({
      path: "guide/intro.md",
      anchor: "overview"
    });
    expect(parseMarkdownNavigationTarget("guide/intro.md?plain=1")).toEqual({
      path: "guide/intro.md",
      anchor: undefined
    });
  });

  it("builds stable heading ids and disambiguates duplicates", () => {
    expect(buildHeadingIds(["Overview", "Overview", "中文 标题", "Title & Notes"])).toEqual([
      "overview",
      "overview-1",
      "中文-标题",
      "title-notes"
    ]);
  });
});
