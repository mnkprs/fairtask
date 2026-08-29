/**
 * Render a header + rows either as an aligned terminal table (default: what an agent or a person sees in a
 * terminal) or as a Markdown pipe table (what the README embeds). Terminal mode strips Markdown emphasis.
 */
export type TableFormat = "table" | "markdown";

const plain = (s: string) => s.replace(/\*\*/g, "").replace(/`/g, "");
// Display width: count code points, not UTF-16 units (κ, ▲, ▼, · are single-width).
const width = (s: string) => Array.from(s).length;
const pad = (s: string, w: number) => s + " ".repeat(Math.max(0, w - width(s)));

export function renderTable(header: string[], rows: string[][], format: TableFormat = "table"): string {
  if (format === "markdown") {
    return [`| ${header.join(" | ")} |`, `|${header.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
  }
  const h = header.map(plain);
  const rs = rows.map((r) => r.map(plain));
  const widths = h.map((_, c) => Math.max(width(h[c]!), ...rs.map((r) => width(r[c] ?? ""))));
  const line = (cells: string[]) => `│ ${cells.map((cell, c) => pad(cell, widths[c]!)).join(" │ ")} │`;
  const rule = (l: string, m: string, r: string) => `${l}${widths.map((w) => "─".repeat(w + 2)).join(m)}${r}`;
  return [rule("┌", "┬", "┐"), line(h), rule("├", "┼", "┤"), ...rs.map(line), rule("└", "┴", "┘")].join("\n");
}

/** A section title: Markdown heading in markdown mode, an underlined line in a terminal. */
export function renderTitle(title: string, format: TableFormat = "table"): string {
  return format === "markdown" ? `### ${title}\n` : `${title}\n${"═".repeat(width(title))}`;
}
