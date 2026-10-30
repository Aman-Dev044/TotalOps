/**
 * Parses spoken / typed measurement dictation into a pane.
 * Examples:
 *   "Master bedroom, window 1, 34 and a half by 60 inches"
 *   "Rear windscreen, 1450 by 850 mm"
 *   "Quarter glass, 350 by 250 mm, 2 panes"
 *   "Kitchen window 48 1/4 x 72 in"
 */
export type ParsedPane = { room: string; label: string; width: number; height: number; unit: string; qty: number; raw: string };

const WORD_NUMS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const UNIT_ALIASES: [RegExp, string][] = [
  [/\b(millimet(?:er|re)s?|mm)\b/, 'mm'],
  [/\b(centimet(?:er|re)s?|cm)\b/, 'cm'],
  [/\b(inch(?:es)?|in|")\b/, 'in'],
  [/\b(feet|foot|ft|')\b/, 'ft'],
  [/\b(met(?:er|re)s?|m)\b/, 'm'],
];

function normalise(text: string) {
  let t = ` ${text.toLowerCase().replace(/[–—]/g, '-').replace(/×/g, ' x ')} `;
  // Spoken fractions → numeric fractions
  t = t.replace(/\b(?:and\s+)?(?:a\s+)?(three[\s-]quarters?)\b/g, ' .75 ')
    .replace(/\b(?:and\s+)?(?:a\s+|one\s+)?half\b/g, ' .5 ')
    .replace(/\b(?:and\s+)?(?:a\s+|one\s+)?quarter\b/g, ' .25 ')
    .replace(/\b(?:and\s+)?(?:an?\s+|one\s+)?eighth\b/g, ' .125 ');
  // "twenty four" → 24, single number words
  t = t.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-](one|two|three|four|five|six|seven|eight|nine)\b/g, (_, a, b) => String(WORD_NUMS[a] + WORD_NUMS[b]));
  t = t.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/g, (w) => String(WORD_NUMS[w]));
  t = t.replace(/\bhundred\b/g, '00');
  // "34 1/2" → 34.5 ; "1/2" → .5
  t = t.replace(/(\d+)\s+(\d+)\s*\/\s*(\d+)/g, (_, w, n, d) => String(Number(w) + Number(n) / Number(d)));
  t = t.replace(/(\d+)\s*\/\s*(\d+)/g, (_, n, d) => String(Number(n) / Number(d)));
  // "34 .5" → 34.5
  t = t.replace(/(\d+)\s+\.(\d+)/g, '$1.$2');
  t = t.replace(/\b(by|times)\b/g, ' x ');
  return t.replace(/\s+/g, ' ');
}

export function parseMeasurement(input: string, defaultUnit = 'mm'): ParsedPane | null {
  const raw = input.trim();
  if (!raw) return null;
  const t = normalise(raw);
  const dim = /(\d+(?:\.\d+)?)\s*(?:mm|cm|in|inches|ft|m)?\s*x\s*(\d+(?:\.\d+)?)/.exec(t);
  if (!dim) return null;
  const width = Number(dim[1]);
  const height = Number(dim[2]);
  if (!(width > 0) || !(height > 0)) return null;

  const after = t.slice(dim.index + dim[0].length);
  let unit = '';
  for (const [rx, u] of UNIT_ALIASES) {
    if (rx.test(after.slice(0, 20)) || rx.test(dim[0])) {
      unit = u;
      break;
    }
  }
  if (!unit) unit = width > 300 || height > 300 ? 'mm' : defaultUnit === 'mm' && width < 120 && height < 120 ? 'in' : defaultUnit;

  const qtyMatch = /(\d+)\s*(?:panes?|pieces?|windows|off|times|qty)\b/.exec(after) || /\b(?:qty|quantity|x)\s*(\d+)\b/.exec(after);
  const qty = qtyMatch ? Math.max(1, Math.round(Number(qtyMatch[1]))) : 1;

  // Text before the dimensions gives room + label: "master bedroom, window 1,"
  const before = raw.slice(0, Math.max(0, findRawIndex(raw, dim[1]))).replace(/[,;:\-\s]+$/, '').trim();
  const parts = before.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  const title = (s: string) => s.replace(/\s+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  let room = '';
  let label = '';
  if (parts.length >= 2) {
    room = title(parts[0]);
    label = title(parts.slice(1).join(' '));
  } else if (parts.length === 1) {
    label = title(parts[0]);
  }
  if (!label) label = 'Window';
  return { room, label, width, height, unit, qty, raw };
}

const NUMERIC_TOKEN = /^(\d+([./]\d+)?|and|a|an|half|quarter|quarters|three|eighth|one|two|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|mm|cm|in|inches|ft|m)$/i;

/** Finds where the first dimension (the number before "by"/"x") starts in the original text. */
function findRawIndex(raw: string, firstNumber: string) {
  const sep = /\s(by|x|×|times)\s/i.exec(raw) || /(\d)\s*[x×]\s*\d/i.exec(raw);
  if (!sep) {
    const idx = raw.search(new RegExp(`\\b${Math.floor(Number(firstNumber))}\\b`));
    return idx >= 0 ? idx : 0;
  }
  const left = raw.slice(0, sep.index + (sep[0].match(/^\d/) ? 1 : 0));
  const tokens = left.split(/(\s+|,)/);
  let end = tokens.length;
  while (end > 0) {
    const t = tokens[end - 1].trim().replace(/-/g, ' ');
    if (!t || t.split(' ').every((w) => NUMERIC_TOKEN.test(w))) end--;
    else break;
  }
  return tokens.slice(0, end).join('').length;
}

export const VOICE_SAMPLES = [
  'Driver front door, 650 by 550 mm',
  'Rear windscreen, 1450 by 850 mm',
  'Quarter glass, 350 by 250 mm, 2 panes',
  'Master bedroom, window 1, 34 and a half by 60 inches',
  'Kitchen window, 48 and a quarter by 72 inches',
  'Living room, sliding door, 72 by 84 inches, 2 panes',
  'Boardroom partition, 1200 by 2100 mm, 2 panes',
  'Storefront east glass, 1800 by 2400 mm',
];
