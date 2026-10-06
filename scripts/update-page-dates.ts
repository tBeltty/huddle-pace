// Refreshes src/web/pageDates.json, the source of the sitemap <lastmod> values.
// A page's date only moves when its content hash changes. Run it with `pnpm page-dates`
// after editing a page, its locale strings or its FAQ; the test suite fails when it is stale.
import fs from "node:fs";
import path from "node:path";
import { PAGE_PATHS, computePageHash, readPageDates } from "../src/web/landingPage.js";

const file = path.resolve(process.cwd(), "src", "web", "pageDates.json");
const previous = readPageDates();
const today = new Date().toISOString().slice(0, 10);
const next: Record<string, { hash: string; lastmod: string }> = {};
let changed = 0;

for (const pagePath of [...PAGE_PATHS].sort()) {
  const hash = computePageHash(pagePath);
  const prior = previous[pagePath];
  if (prior && prior.hash === hash) {
    next[pagePath] = prior;
  } else {
    next[pagePath] = { hash, lastmod: today };
    changed += 1;
    console.log(`updated ${pagePath} -> ${today}`);
  }
}

fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
console.log(changed === 0 ? "page dates already up to date" : `${changed} page date(s) refreshed`);
