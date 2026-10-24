export interface Kana {
  id: string
  kana: string
  romaji: string
}

export type SetKey =
  | 'hira'
  | 'kata'
  | 'hiraDaku'
  | 'kataDaku'
  | 'hiraYoon'
  | 'kataYoon'
  | 'confusing'

// [kana, romaji] pairs, space separated: "あ:a い:i ..."
function parse(src: string): [string, string][] {
  return src
    .trim()
    .split(/\s+/)
    .map((tok) => tok.split(':') as [string, string])
}

const HIRA_BASIC = parse(`
あ:a い:i う:u え:e お:o
か:ka き:ki く:ku け:ke こ:ko
さ:sa し:shi す:su せ:se そ:so
た:ta ち:chi つ:tsu て:te と:to
な:na に:ni ぬ:nu ね:ne の:no
は:ha ひ:hi ふ:fu へ:he ほ:ho
ま:ma み:mi む:mu め:me も:mo
や:ya ゆ:yu よ:yo
ら:ra り:ri る:ru れ:re ろ:ro
わ:wa を:wo ん:n
`)

// ぢ/づ use IME-style romaji (di/du) so the romaji→kana direction stays unambiguous.
const HIRA_DAKU = parse(`
が:ga ぎ:gi ぐ:gu げ:ge ご:go
ざ:za じ:ji ず:zu ぜ:ze ぞ:zo
だ:da ぢ:di づ:du で:de ど:do
ば:ba び:bi ぶ:bu べ:be ぼ:bo
ぱ:pa ぴ:pi ぷ:pu ぺ:pe ぽ:po
`)

// Base i-column kana and the romaji stem used before a/u/o.
const YOON_STEMS = parse(`
き:ky し:sh ち:ch に:ny ひ:hy み:my り:ry ぎ:gy じ:j び:by ぴ:py
`)

function hiraToKata(s: string): string {
  return [...s].map((c) => String.fromCharCode(c.charCodeAt(0) + 0x60)).join('')
}

function yoon(): [string, string][] {
  const out: [string, string][] = []
  for (const [base, stem] of YOON_STEMS) {
    for (const [small, vowel] of [['ゃ', 'a'], ['ゅ', 'u'], ['ょ', 'o']]) {
      out.push([base + small, stem + vowel])
    }
  }
  return out
}

const toKata = (list: [string, string][]): [string, string][] =>
  list.map(([k, r]) => [hiraToKata(k), r])

const RAW: Record<Exclude<SetKey, 'confusing'>, [string, string][]> = {
  hira: HIRA_BASIC,
  kata: toKata(HIRA_BASIC),
  hiraDaku: HIRA_DAKU,
  kataDaku: toKata(HIRA_DAKU),
  hiraYoon: yoon(),
  kataYoon: toKata(yoon()),
}

/** Groups of look-alike kana; these stay next to each other on the grid. */
export const CONFUSING_GROUPS: string[][] = [
  ['シ', 'ツ'],
  ['ソ', 'ン'],
  ['ぬ', 'め'],
  ['わ', 'れ', 'ね'],
  ['は', 'ほ'],
  ['ク', 'タ'],
  ['ウ', 'ワ'],
  ['さ', 'ち'],
  ['る', 'ろ'],
  ['あ', 'お'],
  ['い', 'り'],
  ['コ', 'ユ'],
  ['ナ', 'メ'],
  ['チ', 'テ'],
]

export const KANA: Record<string, Kana> = {}
for (const list of Object.values(RAW)) {
  for (const [kana, romaji] of list) KANA[kana] = { id: kana, kana, romaji }
}

export const SET_IDS: Record<SetKey, string[]> = {
  ...(Object.fromEntries(
    Object.entries(RAW).map(([k, list]) => [k, list.map(([kana]) => kana)]),
  ) as Record<Exclude<SetKey, 'confusing'>, string[]>),
  confusing: CONFUSING_GROUPS.flat(),
}

export interface SetInfo {
  key: SetKey
  label: string
  script: '히라가나' | '가타카나' | '혼합'
}

export const SETS: SetInfo[] = [
  { key: 'hira', label: '기본 46', script: '히라가나' },
  { key: 'hiraDaku', label: '탁음·반탁음', script: '히라가나' },
  { key: 'hiraYoon', label: '요음', script: '히라가나' },
  { key: 'kata', label: '기본 46', script: '가타카나' },
  { key: 'kataDaku', label: '탁음·반탁음', script: '가타카나' },
  { key: 'kataYoon', label: '요음', script: '가타카나' },
  { key: 'confusing', label: '헷갈리는 쌍', script: '혼합' },
]

/** Unique item ids for the chosen sets, in natural (gojūon) order. */
export function idsForSets(keys: SetKey[]): string[] {
  const order: SetKey[] = SETS.map((s) => s.key)
  const seen = new Set<string>()
  for (const key of order) {
    if (!keys.includes(key)) continue
    for (const id of SET_IDS[key]) seen.add(id)
  }
  return [...seen]
}
