/**
 * Fetch OpenAI's SWE-bench Verified human annotations from their pinned public source and verify the checksum.
 *
 * OpenAI published `ensembled_annotations_public.csv` with "Introducing SWE-bench Verified" (August 2024). The
 * original CDN URLs no longer resolve, so the file is fetched from a research mirror at an immutable commit and
 * checked against the SHA-256 of the copy committed in this repository. The committed copy is what every score is
 * measured against; this script proves it is what the source served.
 *
 * Usage: node src/data/fetch-annotations.ts [--check]     (--check: verify the committed file only, no download)
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { ROOT } from "../lib/paths.ts";

export const ANNOTATIONS = {
  publisher: "OpenAI — Introducing SWE-bench Verified (2024-08-13)",
  mirror: "mariushobbhahn/SWEBench-verified-mini",
  commit: "80e15f699bb426e352aa1d829b554314d246a17a",
  file: "data/external_data/ensembled_annotations_public.csv",
  sha256: "d2743650f6b2d31eeaf6d9952c3766b022930964d9d9452fc35cfbeb1967827c",
  rows: 1699,
};
const url = `https://raw.githubusercontent.com/${ANNOTATIONS.mirror}/${ANNOTATIONS.commit}/${ANNOTATIONS.file}`;
const target = `${ROOT}data/raw/ensembled_annotations_public.csv`;
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

if (process.argv.includes("--check")) {
  const h = sha(readFileSync(target));
  if (h !== ANNOTATIONS.sha256) { console.error(`committed annotations do not match the pinned source: ${h}`); process.exit(1); }
  console.log(`committed annotations verified: sha256 ${h.slice(0, 16)}… (${ANNOTATIONS.rows} rows, mirror commit ${ANNOTATIONS.commit.slice(0, 7)})`);
} else {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const h = sha(bytes);
  if (h !== ANNOTATIONS.sha256) throw new Error(`downloaded file sha256 ${h} does not match the expected ${ANNOTATIONS.sha256}; refusing to write it`);
  writeFileSync(target, bytes);
  console.log(`fetched ${bytes.length} bytes from ${url}\nsha256 ${h} — matches the pinned source; written to data/raw/`);
}
