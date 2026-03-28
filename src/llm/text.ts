export function truncate(input: string, maxChars: number): string {
  const s = input ?? '';
  if (s.length <= maxChars) return s;
  if (maxChars <= 1) return '…';
  return `${s.slice(0, Math.max(0, maxChars - 1))}…`;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_m, code) => {
      const n = Number(code);
      if (!Number.isFinite(n)) return '';
      return String.fromCharCode(n);
    });
}

export function stripHtmlToText(html: string): string {
  let text = html ?? '';

  // Remove scripts/styles since they add noise.
  text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');

  // Keep some structure using newlines.
  text = text
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<\/li\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, ' ')
    .replace(/<\/h\d\s*>/gi, '\n');

  // Drop tags.
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode entities and normalize whitespace.
  text = decodeHtmlEntities(text);
  text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]{2,}/g, ' ');
  return text.trim();
}
