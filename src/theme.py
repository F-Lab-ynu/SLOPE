# 部員画面の色を、テーマで変えられる形（CSS変数）に置きかえる
import re
BG, FG = (7, 7, 7), (243, 241, 236)
def lum(c): return sum(c) / 3
def neutral(h):
    r, g, b = int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)
    return max(r, g, b) - min(r, g, b) <= 14, (r, g, b)
def apply(s):
    hexes = sorted(set(m.upper() for m in re.findall(r'#[0-9A-Fa-f]{6}\b', s)))
    mp, steps = {}, set()
    for h in hexes:
        if h == '#F2A93B': mp[h] = 'var(--ac)'; continue
        ok, c = neutral(h)
        if not ok: continue
        p = round((lum(c) - lum(BG)) / (lum(FG) - lum(BG)) * 100)
        if p <= 1: mp[h] = 'var(--bg)'
        elif p >= 99: mp[h] = 'var(--fg)'
        elif p > 100: continue
        else: mp[h] = 'var(--n%d)' % p; steps.add(p)
    def sub(m):
        txt = m.group(0)
        if txt.startswith('<meta'): return txt
        return re.sub(r'#[0-9A-Fa-f]{6}\b', lambda x: mp.get(x.group(0).upper(), x.group(0)), txt)
    # meta タグはそのまま、それ以外の色を置きかえる
    # /*NOTHEME*/ 〜 /*/NOTHEME*/ の間（テーマの色見本そのもの）は置きかえない
    parts = re.split(r'(/\*NOTHEME\*/.*?/\*/NOTHEME\*/)', s, flags=re.S)
    s = ''.join(x if x.startswith('/*NOTHEME*/') else re.sub(r'<meta[^>]*>|[^<]+|<(?!meta)[^>]*>', sub, x) for x in parts)
    s = s.replace('rgba(242,169,59,0.25)', 'color-mix(in srgb, var(--ac) 25%, transparent)').replace('rgba(242, 169, 59, 0.25)', 'color-mix(in srgb, var(--ac) 25%, transparent)')
    root = ':root{--bg:#070707;--fg:#F3F1EC;--ac:#F2A93B;' + ''.join('--n%d:color-mix(in srgb,var(--fg) %d%%,var(--bg));' % (p, p) for p in sorted(steps)) + '}\n'
    exprs = sorted(set(mp.values()))
    attr = ''.join('[fill="%s"]{fill:%s}[stroke="%s"]{stroke:%s}' % (e, e, e, e) for e in exprs) + '\n'
    s = s.replace('</style>', root + attr + 'html,body{background:var(--bg)}\nhtml.light .mark,html.light .wordmark,html.light .bootlogo{filter:invert(1)}\n</style>', 1)
    return s, mp
