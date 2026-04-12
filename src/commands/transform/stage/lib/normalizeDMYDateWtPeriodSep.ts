export function normalizeDMYDateWtPeriodSep(DMY: string): string {
  const [day, month, year] = DMY.split('.');
  return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10)).toISOString();
}
