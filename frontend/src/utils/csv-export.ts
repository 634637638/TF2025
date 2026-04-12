export const escapeCsvCell = (value: unknown) => {
  const normalized = value === null || value === undefined ? '' : String(value)
  const escaped = normalized.replace(/"/g, '""')
  return `"${escaped}"`
}

export const buildCsvContent = (headers: string[], rows: Array<Array<unknown>>) => {
  const headerLine = headers.map((item) => escapeCsvCell(item)).join(',')
  const rowLines = rows.map((row) => row.map((item) => escapeCsvCell(item)).join(','))
  return [headerLine, ...rowLines].join('\n')
}
