export function normalizeSeniority(seniority: string): string | null {
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
    return 'c-level';
  }
  if (seniority === '') {
    return null;
  }
  return seniority;
}
