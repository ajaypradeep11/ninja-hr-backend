const STEMS: string[] = [
  'f[u*@]ck\\w*',
  'sh[i*1!]t\\w*',
  'b[i*1!]tch\\w*',
  'c[u*]nts?',
  'a[s$*]{2}hole\\w*',
  'bastards?',
  'd[i*1]ckheads?',
  'c[o*0]cksucker\\w*',
  'wh[o*0]res?',
  'sluts?',
  'tw[a*@]ts?',
  'wankers?',
  'd[o*0]uchebags?',
  'motherf[u*@]cker\\w*',
  'n[i*1!]gg\\w*',
  'f[a*@]gg[o*0]ts?',
  'k[i*1]kes?',
  'sp[i*1]cs?',
  'ch[i*1]nks?',
  'g[o*0]{2}ks?',
  'wetbacks?',
  'beaners?',
  'ragheads?',
  'towelheads?',
  'tr[a*@]nn(?:y|ies)',
  'r[e*3]t[a*@]rd\\w*',
  'dykes?',
  'c[o*0]{2}ns?',
];

const BLOCKLIST_RE = new RegExp(`\\b(?:${STEMS.join('|')})\\b`, 'i');

export function scanBlocklist(text: string): boolean {
  if (!text) return false;
  return BLOCKLIST_RE.test(text);
}
