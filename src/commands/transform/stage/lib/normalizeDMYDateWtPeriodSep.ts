export function normalizeDMYDateWtPeriodSep(DMY: string): string {
  const [day, month, year] = DMY.split('.');
  try {
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10)).toISOString();
  } catch (error) {
    throw new Error(`Unable to normalize date from string "${DMY}"`, { cause: error });
  }
}
