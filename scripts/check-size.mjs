#!/usr/bin/env node

/**
 * @deprecated Use `node cli.mjs check-size` (or `pnpm size`) instead.
 * All logic migrated to checks/size.mjs. This stub delegates to the new module.
 */

import { run } from "../checks/size.mjs"
const ec = await run({})
process.exit(ec)

