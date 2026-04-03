const NFJ_OFFER_VALID_UNTIL = /Offer valid until:\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\b/i;
const BDJ_VALID_FOR_DAYS = /Valid for\s+(\d+)\s+days?\b/i;

function nfjExpiresFromMarkdown(markdown: string): string {
  const m = markdown.match(NFJ_OFFER_VALID_UNTIL);
  if (!m) {
    return '';
  }
  const day = Number.parseInt(m[1]!, 10);
  const month = Number.parseInt(m[2]!, 10);
  const year = Number.parseInt(m[3]!, 10);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    return '';
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return '';
  }
  const exp = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  if (
    exp.getUTCFullYear() !== year ||
    exp.getUTCMonth() !== month - 1 ||
    exp.getUTCDate() !== day
  ) {
    return '';
  }
  return exp.toISOString();
}

function bdjExpiresFromMarkdown(markdown: string): string {
  const m = markdown.match(BDJ_VALID_FOR_DAYS);
  if (!m) {
    return '';
  }
  const days = Number.parseInt(m[1]!, 10);
  if (!Number.isFinite(days) || days < 0) {
    return '';
  }
  const now = new Date();
  const exp = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days, 23, 59, 59, 999),
  );
  return exp.toISOString();
}

const strategyExpiryExtractors: Record<string, (markdown: string) => string> = {
  nfj: nfjExpiresFromMarkdown,
  bdj: bdjExpiresFromMarkdown,
  jji: () => '',
};

export function extractExpiresFromMarkdown(strategySlug: string, markdown: string): string {
  const extractor = strategyExpiryExtractors[strategySlug];
  if (!extractor) {
    return '';
  }
  return extractor(markdown);
}
