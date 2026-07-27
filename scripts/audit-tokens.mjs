#!/usr/bin/env node

/**
 * @deprecated Use `node cli.mjs COMMAND` instead.
 * This stub delegates to the new checks/ module.
 */

const MAP = {
  "audit-tokens.mjs": "check-tokens",
  "change-budget.mjs": "change-budget",
  "check-desktop-parity.mjs": "check-parity",
  "check-pack-install.mjs": "check-pack-install",
  "check-rsc-directive.mjs": "check-rsc",
  "test-coverage-report.mjs": "check-coverage",
}

import { execSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const cmd = MAP["audit-tokens.mjs"] || "audit-tokens"
try {
  execSync("node " + resolve(ROOT, "cli.mjs") + " " + cmd, { stdio: "inherit", cwd: ROOT })
  process.exit(0)
} catch (e) {
  process.exit(1)
}
