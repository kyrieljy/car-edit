import { NextResponse } from "next/server"

export type CsvColumn<T> = {
  key: keyof T & string
  label: string
  format?: (value: T) => string
}

/**
 * Escape a CSV cell value. Wraps in double quotes if the value contains
 * commas, double quotes, or newlines. Doubles any embedded double quotes.
 */
function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Build a CSV string from rows and column definitions.
 * Prepends a UTF-8 BOM so Excel correctly detects encoding.
 */
export function buildCsv<T extends Record<string, unknown>>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((col) => escapeCsvCell(col.label)).join(",")
  const lines = rows.map((row) =>
    columns
      .map((col) => {
        const value = col.format ? col.format(row) : String(row[col.key] ?? "")
        return escapeCsvCell(value)
      })
      .join(","),
  )
  return "\uFEFF" + [header, ...lines].join("\r\n")
}

/**
 * Create a NextResponse that downloads the given rows as a CSV file.
 */
export function createCsvResponse<T extends Record<string, unknown>>(
  rows: T[],
  columns: CsvColumn<T>[],
  filename: string,
): NextResponse {
  const csv = buildCsv(rows, columns)
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
