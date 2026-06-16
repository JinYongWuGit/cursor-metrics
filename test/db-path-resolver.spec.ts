import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { resolveCursorStateDbPathForTest } from "../src/cursor-api";

describe("Cursor DB path resolver", () => {
  it("prefers env override over everything else", () => {
    const resolved = resolveCursorStateDbPathForTest({
      platform: "linux",
      env: { CURSOR_USAGE_DB_PATH: "/custom/state.vscdb", WSL_DISTRO_NAME: "Ubuntu" },
      dbPathOverride: "/from-setting/state.vscdb",
      wslMountRoot: "/mnt/c",
    });
    expect(resolved).toBe("/custom/state.vscdb");
  });

  it("prefers setting override over WSL probing and defaults", () => {
    const resolved = resolveCursorStateDbPathForTest({
      platform: "linux",
      env: { WSL_DISTRO_NAME: "Ubuntu" },
      dbPathOverride: "/from-setting/state.vscdb",
      wslMountRoot: "/mnt/c",
    });
    expect(resolved).toBe("/from-setting/state.vscdb");
  });

  it("in WSL, probes /mnt/c/Users/* and picks the first user with state.vscdb", () => {
    const root = mkdtempSync(join(tmpdir(), "cursor-usage-wsl-mnt-"));
    const usersDir = join(root, "Users");
    mkdirSync(usersDir, { recursive: true });

    // Include a few entries that should be ignored or not matched.
    mkdirSync(join(usersDir, "Public"), { recursive: true });
    mkdirSync(join(usersDir, "Zed"), { recursive: true });

    // Create 2 real user profiles, with the file existing only under "Alice".
    const aliceDb = join(
      usersDir,
      "Alice",
      "AppData/Roaming/Cursor/User/globalStorage/state.vscdb",
    );
    mkdirSync(dirname(aliceDb), { recursive: true });
    writeFileSync(aliceDb, "");

    const bobDb = join(
      usersDir,
      "Bob",
      "AppData/Roaming/Cursor/User/globalStorage/state.vscdb",
    );
    mkdirSync(dirname(bobDb), { recursive: true });

    const resolved = resolveCursorStateDbPathForTest({
      platform: "linux",
      env: { WSL_DISTRO_NAME: "Ubuntu" },
      dbPathOverride: null,
      wslMountRoot: root,
    });
    expect(resolved).toBe(aliceDb);
  });

  it("falls back to platform defaults if WSL probing finds nothing", () => {
    const root = mkdtempSync(join(tmpdir(), "cursor-usage-wsl-mnt-empty-"));
    mkdirSync(join(root, "Users", "Alice"), { recursive: true });

    const resolved = resolveCursorStateDbPathForTest({
      platform: "linux",
      env: { WSL_DISTRO_NAME: "Ubuntu" },
      dbPathOverride: null,
      wslMountRoot: root,
    });
    expect(resolved).toContain(".config");
    expect(resolved).toContain("Cursor/User/globalStorage/state.vscdb");
  });
});

