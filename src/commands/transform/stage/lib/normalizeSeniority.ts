export function normalizeSeniority(seniority: string): string {
  seniority = seniority.trim().toLowerCase();
  if (seniority === 'trainee') {
    return 'intern';
  }
  if (seniority === 'medium') {
    return 'regular';
  }
  if (seniority === 'mid') {
    return 'regular';
  }
  if (seniority === 'c_level') {
    return 'management';
  }
  return seniority;
}
