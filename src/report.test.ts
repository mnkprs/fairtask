import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("report refuses a --final-repeat of a different configuration", () => {
  assert.throws(
    () => execFileSync(process.execPath, ["src/report.ts", "--baseline", "baseline", "--final", "v3-verify", "--final-repeat", "v5-rerun"], { encoding: "utf8", stdio: "pipe" }),
    (e: unknown) => String((e as { stderr?: string }).stderr).includes("is not a repeat of") && String((e as { stderr?: string }).stderr).includes("variant"),
  );
});
