const polishToAscii: Record<string, string> = {
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
  Ą: 'a',
  Ć: 'c',
  Ę: 'e',
  Ł: 'l',
  Ń: 'n',
  Ó: 'o',
  Ś: 's',
  Ź: 'z',
  Ż: 'z',
};

function transliteratePolish(s: string): string {
  let out = '';
  for (const ch of s) {
    out += polishToAscii[ch] ?? ch;
  }
  return out;
}

export function lowercaseAndTransliterate(input: string): string {
  const trimmed = input.trim();
  const transliterated = transliteratePolish(trimmed);
  return transliterated.toLowerCase();
}
