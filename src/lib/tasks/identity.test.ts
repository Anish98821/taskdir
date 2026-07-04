import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseFolderName, slugify } from "./identity.ts";

describe("slugify", () => {
  it("normalizes titles into filesystem slugs", () => {
    assert.equal(slugify("Add auth: OAuth + sessions!"), "add-auth-oauth-sessions");
  });

  it("falls back for titles without slug characters", () => {
    assert.equal(slugify("!@#$"), "task");
  });

  it("caps slugs at the current folder-name limit", () => {
    assert.equal(slugify("a".repeat(80)), "a".repeat(40));
  });
});

describe("parseFolderName", () => {
  it("extracts task id and slug from task folders", () => {
    assert.deepEqual(parseFolderName("0042-add-auth"), {
      id: "0042",
      slug: "add-auth",
      folder: "0042-add-auth",
    });
  });

  it("rejects folder names without numeric prefixes", () => {
    assert.equal(parseFolderName("add-auth"), null);
  });
});
