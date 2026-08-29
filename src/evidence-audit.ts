/**
 * Post-hoc evidence audit: run the deterministic verifier over every verdict of the given runs and report how much
 * of the cited evidence actually checks out.
 *
 * Usage: node src/evidence-audit.ts <run-id> [...]
 */
import { auditRun } from "./lib/audit.ts";

const runIds = process.argv.slice(2).filter((a) => !a.startsWith("--"));
console.log(`${"run".padEnd(18)}${"verdicts".padStart(9)}${"evidence".padStart(9)}${"bad items".padStart(11)}${"item rate".padStart(11)}${"verdicts w/ bad".padStart(17)}${"score>=2 unbacked".padStart(19)}`);
for (const id of runIds) {
  const a = auditRun(id);
  console.log(`${id.padEnd(18)}${String(a.verdicts).padStart(9)}${String(a.items).padStart(9)}${String(a.bad_items).padStart(11)}${`${(100 * a.bad_items / (a.items || 1)).toFixed(0)}%`.padStart(11)}${`${a.verdicts_with_bad} (${(100 * a.verdicts_with_bad / (a.verdicts || 1)).toFixed(0)}%)`.padStart(17)}${String(a.unbacked_scores).padStart(19)}`);
}
