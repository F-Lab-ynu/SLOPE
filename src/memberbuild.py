# 部員アプリ（本番）を組み立てる：部員アプリのモック + member_data.js + member.js
import re
src = open('src/mock/member-mock.html').read()
s = src
DATA = open('src/member_data.js').read()
MJS = open('src/member.js').read()

def rep(a, b, c=1):
    global s
    n = s.count(a)
    assert n == c, (n, a[:80])
    s = s.replace(a, b)

def rline(snip, new, c=1):
    """snip を含む行をまるごと new に置き換える"""
    global s
    lines = s.split('\n')
    idx = [i for i, l in enumerate(lines) if snip in l]
    assert len(idx) == c, (len(idx), snip)
    for i in idx:
        lines[i] = new if not callable(new) else new(lines[i])
    s = '\n'.join(lines)

# ---------- データ部分を差し替え ----------
i = s.index("    const recruitsRaw = [")
j = s.index("    // ---- Markets (sample figures) ----")
s = s[:i] + DATA + s[j:]

# ---------- テンプレート：ホーム ----------
rline('<span class="lbl" style="padding-left: 2px">FRI · 11.13</span>', '<span class="lbl" style="padding-left: 2px">{{ todayLabel }}</span>')
rep('const go = (tab) => () => this.setState({ tab: tab, sub: null });', 'const go = (tab) => () => { if (window.__track) window.__track(tab); this.setState({ tab: tab, sub: null }); };')
rep("goBoard: () => this.setState({ tab: 'board', sub: null, seg: 'recruit' })", "goBoard: () => { if (window.__track) window.__track('board'); this.setState({ tab: 'board', sub: null, seg: 'recruit' }); }")
rep('line-height: 1.3">こんにちは、太郎さん</h1>', 'line-height: 1.3">{{ hello }}</h1>')
rep('color: #F2A93B">NEXT · 部内イベント</span>', 'color: {{ next.lc }}">{{ next.label }}</span>')
rep('<span style="flex: none; display: flex; flex-direction: column; align-items: flex-end">', '<span style="flex: none; display: {{ next.rd }}; flex-direction: column; align-items: flex-end">')
rep('<span style="font-size: 21px; font-weight: 700; line-height: 1.3">MIRA エントリー締切</span>', '<span style="font-size: {{ next.tfs }}; font-weight: 700; line-height: 1.3; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere">{{ next.title }}</span>')
rep('<span style="display: flex; flex-direction: column; gap: 8px; min-width: 0">', '<span style="display: flex; flex-direction: column; gap: 8px; min-width: 0; flex: 1">')
rep('<button onClick="{{ goCal }}" class="card" style="grid-column: span 2; width: 100%; padding: 22px 20px;', '<div class="tcar" style="grid-column: span 2"><div class="tcart"><sc-for list="{{ anns }}" as="a"><button onClick="{{ a.go }}" class="card tslide" style="width: 100%; min-height: 138px; padding: 22px 20px; display: flex; flex-direction: column; justify-content: center; gap: 8px; text-align: left; color: #F3F1EC; background: #131313; border-color: #383836"><span class="en" style="font-size: 12px; letter-spacing: 0.12em; font-weight: 700; color: #F2A93B">お知らせ</span><span style="font-size: {{ a.tfs }}; font-weight: 700; line-height: 1.3; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere">{{ a.title }}</span><span style="font-size: 14px; line-height: 1.55; color: #BDBAB3; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere">{{ a.body }}</span></button></sc-for><button onClick="{{ next.go }}" class="card tslide" style="width: 100%; min-height: 138px; padding: 22px 20px;')
rep('</button>\n\n<button onClick="{{ goLearn }}" class="card"', '</button></div><sc-if value="{{ hasAnn }}"><div class="tdots" aria-hidden="true"><sc-for list="{{ dots }}" as="d"><i></i></sc-for></div></sc-if></div>\n\n<button onClick="{{ goLearn }}" class="card"')
rep('<span class="en" style="font-size: 14px; color: #BDBAB3">11.21 SAT · 23:59</span>', '<span class="{{ next.wc }}" style="font-size: 14px; line-height: 1.55; color: #BDBAB3; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere">{{ next.when }}</span>')
rep('line-height: 0.85">8</span>', 'line-height: 0.85">{{ next.left }}</span>')
rep('stroke-dasharray="39.5 138.2"', 'stroke-dasharray="{{ learnCard.dash }}"')
rep('font-size: 13px; font-weight: 700">2/7</span>', 'font-size: 13px; font-weight: 700">{{ learnCard.n }}</span>')
rep('<span class="en" style="font-size: 12px; color: #A3A19B">Strategist</span><span style="font-size: 14px; font-weight: 700; line-height: 1.35">ST2<br>戦略理論</span>',
    '<span class="en" style="font-size: 12px; color: #A3A19B">{{ learnCard.track }}</span><span style="font-size: 14px; font-weight: 700; line-height: 1.35; white-space: pre-line; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; overflow-wrap: anywhere">{{ learnCard.next }}</span>')
rep('<button onClick="{{ goJoin }}" class="card"', '<button onClick="{{ card2.go }}" class="card"')
rep('color: #A3A19B">参加予定</span>', 'color: #A3A19B">{{ card2.label }}</span>')
rep('line-height: 0.9; color: #F2A93B">2</span>', 'line-height: 0.9; color: #F2A93B">{{ card2.n }}</span>')
rep('color: #BDBAB3">次 11.18 演習会：戦略理論</span>', 'color: #BDBAB3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%">{{ card2.note }}</span>')
rep('<span class="big" style="font-size: 46px; font-weight: 700; line-height: 0.9">4</span>', '<span class="big" style="font-size: 46px; font-weight: 700; line-height: 0.9">{{ weekCount }}</span>')
rline('<span class="big" style="font-size: 46px; font-weight: 700; line-height: 0.9">5</span>',
      '<span style="display: flex; align-items: center; justify-content: space-between; gap: 8px"><span style="display: flex; align-items: baseline; gap: 4px"><span class="big" style="font-size: 46px; font-weight: 700; line-height: 0.9">{{ boardNew.n }}</span><span style="font-size: 14px; color: #A3A19B">件</span></span><span style="display: flex; padding-left: 6px"><sc-for list="{{ boardNew.inis }}" as="b"><span style="width: 26px; height: 26px; border-radius: 50%; margin-left: -6px; background: #3A3936; border: 2px solid #131313; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: #F3F1EC">{{ b.i }}</span></sc-for></span></span>')
rep('color: #BDBAB3">募集 3 · ペイン 2</span>', 'color: #BDBAB3">{{ boardNew.note }}</span>')
# ニュースはAPI連携まで隠す
rep('<button onClick="{{ newsHome.open }}"', '<sc-if value="{{ hasNews }}"><button onClick="{{ newsHome.open }}"')
rep('{{ newsHome.title }}</span>\n<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5F5E5A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none"><path d="M7 17 17 7"></path><path d="M9 7h8v8"></path></svg>\n</button>',
    '{{ newsHome.title }}</span>\n<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5F5E5A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none"><path d="M7 17 17 7"></path><path d="M9 7h8v8"></path></svg>\n</button></sc-if>')
# 自分の業務・お知らせ（ホームのカードの下に追加）
TASKS = '''<sc-if value="{{ hasTasks }}">
<div style="display: flex; flex-direction: column; gap: 14px">
<h2 class="h2">自分の業務</h2>
<div class="card" style="padding: 0 18px">
<sc-for list="{{ tasks }}" as="t">
<div style="display: flex; align-items: center; gap: 12px; padding: 16px 0; border-bottom: {{ t.sep }}">
<span style="flex: 1; display: flex; flex-direction: column; gap: 5px; min-width: 0">
<span style="font-weight: 700; font-size: 15px; line-height: 1.45; word-break: auto-phrase">{{ t.title }}</span>
<span style="font-size: 12px; color: #A3A19B">{{ t.event }} · <span style="color: {{ t.dueColor }}">{{ t.due }}</span></span>
</span>
<button onClick="{{ t.done }}" style="flex: none; height: 38px; padding: 0 16px; border-radius: 6px; border: 0; background: #F3F1EC; color: #070707; font-weight: 700; font-size: 14px">完了</button>
</div>
</sc-for>
</div>
</div>
</sc-if>
'''
rep('<div style="display: flex; flex-direction: column; gap: 4px; padding: 4px 4px 0">\n<div class="tv" ref="{{ mk.homeRef }}"', TASKS + '<div style="display: flex; flex-direction: column; gap: 4px; padding: 4px 4px 0">\n<div class="tv" ref="{{ mk.homeRef }}"')

# ---------- 学ぶ ----------
# (演習タブは廃止) rep('<span class="en" style="margin-left: 6px; font-size: 13px; padding: 1px 6px; border-radius: 6px; background: #F2A93B; color: #070707">2</span>', '<sc-if value="{{ hasPracBadge }}"><span class="en" style="margin-left: 6px; font-size: 13px; padding: 1px 6px; border-radius: 6px; background: #F2A93B; color: #070707">{{ pracBadge }}</span></sc-if>')
# (学ぶタブ作り替えで不要) rep('line-height: 1; color: #F3F1EC">02</span>', 'line-height: 1; color: #F3F1EC">{{ level.lv }}</span>')
# (学ぶタブ作り替えで不要) rep('<div style="font-weight: 700">Strategist 受講中</div>', '<div style="font-weight: 700">{{ level.track }}</div>')
# (学ぶタブ作り替えで不要) rep('color: #BDBAB3">マイルストーン 6 / 14 達成</div>', 'color: #BDBAB3">{{ level.ms }}</div>')
# (学ぶタブ作り替えで不要) rep('<div style="width: 43%; height: 100%; background: #F3F1EC"></div>', '<div style="width: {{ level.w }}; height: 100%; background: #F3F1EC"></div>')
# (学ぶタブ作り替えで不要) rep('color: #BDBAB3">8 / 8 修了 · LUNA 修了</span>', 'color: #BDBAB3">{{ baseNote }}</span>')
# (学ぶタブ作り替えで不要) rep('<span class="en" style="font-size: 16px; font-weight: 700; color: #F3F1EC">100%</span>', '<span class="en" style="font-size: 16px; font-weight: 700; color: #F3F1EC">{{ basePct }}</span>')
# (学ぶタブ作り替えで不要) rep('<div style="height: 3px; background: #222221"><div style="width: 100%; height: 100%; background: #F3F1EC"></div></div>', '<div style="height: 3px; background: #222221"><div style="width: {{ basePct }}; height: 100%; background: #F3F1EC"></div></div>')
# (学ぶタブ作り替えで不要) rep('<span class="lbl">受講中：Strategist</span>', '<span class="lbl">{{ roleNote }}</span>')
# (学ぶタブ作り替えで不要) rep('<span class="en" style="font-size: 16px; font-weight: 700; color: #F3F1EC">29%</span>', '<span class="en" style="font-size: 16px; font-weight: 700; color: #F3F1EC">{{ rolePct }}</span>')
# 単元を開くボタンは各行の単元へ
lines = s.split('\n'); out = []; loopvar = None
for l in lines:
    m = re.search(r'<sc-for list="\{\{ (baseUnits|g\.items|libItems|unitGroups) \}\}" as="(\w+)"', l)
    if m: loopvar = m.group(2)
    if 'onClick="{{ openUnit }}"' in l and loopvar: l = l.replace('onClick="{{ openUnit }}"', 'onClick="{{ ' + loopvar + '.open }}"')
    if '</sc-for>' in l: pass
    out.append(l)
s = '\n'.join(out)
assert 'onClick="{{ openUnit }}"' not in s.split('<template id="tpl">')[1].split('</template>')[0], 'openUnit left'
rep('<input type="search" placeholder="教材を検索" aria-label="教材を検索"', '<input type="search" placeholder="教材を検索" aria-label="教材を検索" onInput="{{ setLq }}"')
rep('<input type="search" aria-label="単元を検索" placeholder="単元を検索"', '<input type="search" aria-label="単元を検索" placeholder="単元を検索" onInput="{{ setUq }}"')
# 教材ライブラリ：サムネイル（なければ種類）。「外部」の印は全部同じなので出さない
rep('<span style="flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0">\n<span style="font-weight: 500; font-size: 15px">{{ m.title }}</span>\n<span style="font-size: 13px; color: #A3A19B">{{ m.kind }} · {{ m.min }}',
    '<sc-if value="{{ m.hasImg }}"><img class="mth" src="{{ m.img }}" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'mth ph\'}))"></sc-if><sc-if value="{{ m.noImg }}"><span class="mth ph">{{ m.kind }}</span></sc-if>\n<span style="flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0">\n<span class="mtt" style="font-weight: 500; font-size: 15px">{{ m.title }}</span>\n<span style="font-size: 13px; color: #A3A19B; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ m.kind }} · {{ m.min }}')
rep('<span class="chip" style="flex: none; border-color: {{ m.color }}; color: {{ m.color }}">{{ m.src }}</span>', '')
# 部内イベント：カードを押すと詳細へ
rep('<sc-for list="{{ clubEvents }}" as="e" hint-placeholder-count="2">\n<div class="card" style="padding: 14px 16px; display: flex; align-items: center; gap: 14px">', '<sc-for list="{{ clubEvents }}" as="e" hint-placeholder-count="2">\n<div class="card" data-evid="{{ e.id }}" role="button" tabindex="0" style="padding: 14px 16px; display: flex; align-items: center; gap: 14px; cursor: pointer">')
# 単元の詳細
rep('<span class="lbl">Strategist · ST2</span>\n<h1 style="margin: 0; font-size: 28px; font-weight: 700">戦略理論</h1>', '<span class="lbl">{{ unit.head }}</span>\n<h1 style="margin: 0; font-size: 28px; font-weight: 700">{{ unit.title }}</h1>')
rep('<span class="chip">前提：ST1 社会情勢と業界 ✓</span><span class="chip">対面の演習会あり</span>', '<span class="chip">{{ unit.deps }}</span><sc-if value="{{ unit.inperson }}"><span class="chip">対面の演習会あり</span></sc-if>')
rep('<sc-for list="{{ materials }}" as="m" hint-placeholder-count="3">\n<div class="card" style="padding: 14px 16px; border-radius: 8px; display: flex; align-items: center; gap: 12px">',
    '<sc-if value="{{ unit.noMaterials }}"><div style="font-size: 14px; color: #A3A19B">教材はまだ登録されていません</div></sc-if>\n<sc-for list="{{ materials }}" as="m" hint-placeholder-count="3">\n<button onClick="{{ m.go }}" class="card" style="padding: 14px 16px; border-radius: 8px; display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; color: #F3F1EC">')
rep('<span class="chip" style="border-color: {{ m.color }}; color: {{ m.color }}">{{ m.src }}</span>\n</div>\n</sc-for>', '<span class="chip" style="border-color: {{ m.color }}; color: {{ m.color }}">開く ↗</span>\n</button>\n</sc-for>')
# (演習は廃止) rline('>LUNAの事業でポジショニングを描く</div>', '<div style="font-weight: 700; font-size: 17px; line-height: 1.4; word-break: auto-phrase">{{ unit.practiceTitle }}</div>')
# (演習は廃止) rline('LUNAで扱った事業の競合', '<div style="font-size: 14px; color: #D2CFC8; line-height: 1.7; white-space: pre-wrap">{{ unit.practice }}</div>')
# (演習は廃止) rline('<span>締切 11.20 FRI 23:59</span><span>提出 9 / 14</span>', '<span></span>')
rline('font-size: 16px">修了にする</button>', '<button onClick="{{ unit.toggle }}" style="height: 48px; border: 1px solid #F3F1EC; border-radius: 8px; background: {{ unit.doneBg }}; color: {{ unit.doneFg }}; font-weight: 700; font-size: 16px">{{ unit.doneLabel }}</button>')
# (確認問題に置きかえ) rep('<span style="font-weight: 500">ST-02 競争優位の源泉を説明できる</span>', '<span style="font-weight: 500">{{ unit.milestone }}</span>')
# 路線図：選んだ単元を開く
# (学ぶタブ作り替えで不要) rep('<span style="color: #A3A19B">後続</span><span style="color: #E9E6DF">{{ cSel.next }}</span>\n</div>', '<span style="color: #A3A19B">後続</span><span style="color: #E9E6DF">{{ cSel.next }}</span>\n</div>\n<sc-if value="{{ cSel.isUnit }}"><button onClick="{{ cSel.open }}" style="height: 44px; border: 0; border-radius: 8px; background: #F3F1EC; color: #070707; font-weight: 700; font-size: 15px">単元を開く</button></sc-if>')

# ---------- 掲示板 ----------
rep('<button style="flex: 1; height: 44px; border-radius: 6px; border: 1px solid #383836; background: #1C1C1B; color: #F3F1EC; font-weight: 700; font-size: 14px">詳細を見る</button>', '<button onClick="{{ x.detailGo }}" style="flex: 1; height: 44px; border-radius: 6px; border: 1px solid #383836; background: #1C1C1B; color: #F3F1EC; font-weight: 700; font-size: 14px">詳細を見る</button>')
# (フリーは作り直し) rep('<input type="text" aria-label="投稿を書く" placeholder="読んだ本でも、雑談でも"', '<input id="otText" type="text" aria-label="投稿を書く" placeholder="読んだ本でも、雑談でも"')
# (フリーは作り直し) rep('<button aria-label="投稿" style="flex: none; width: 46px;', '<button onClick="{{ postOther }}" aria-label="投稿" style="flex: none; width: 46px;')
rep('<button style="height: 40px; padding: 0 16px; border: 0; border-radius: 6px; background: #F3F1EC; color: #070707; font-weight: 700; font-size: 14px">応募する</button>', '<button onClick="{{ s.apply }}" style="height: 40px; padding: 0 16px; border: 0; border-radius: 6px; background: #F3F1EC; color: #070707; font-weight: 700; font-size: 14px">応募する</button>')
rline('flex: none">切り替える</bu', lambda l: l.replace('<button style=', '<button onClick="{{ curToRecruit }}" style='))
rep('<div class="card" style="padding: 16px; border-radius: 8px; display: flex; align-items: center; gap: 12px; margin-top: 4px">', '<sc-if value="{{ curMine }}"><div class="card" style="padding: 16px; border-radius: 8px; display: flex; align-items: center; gap: 12px; margin-top: 4px">')
k = s.index('>切り替える</button>'); k2 = s.index('</div>', k) + len('</div>'); s = s[:k2] + '</sc-if>' + s[k2:]
# コメント入力・通報・削除
CM = '''<div style="display: flex; align-items: center; gap: 8px">
<input id="cmText" type="text" aria-label="フィードバックを書く" placeholder="自分の観点からひとこと" style="flex: 1; min-width: 0; height: 46px; padding: 0 16px; background: #131313; border: 1px solid #383836; border-radius: 6px; color: #F3F1EC; font-size: 15px">
<button onClick="{{ sendComment }}" aria-label="送信" style="flex: none; height: 46px; padding: 0 16px; border: 0; border-radius: 6px; background: #F3F1EC; color: #070707; font-weight: 700; font-size: 14px">送信</button>
</div>
<div style="display: flex; justify-content: flex-end; gap: 8px; padding-top: 8px">
<sc-if value="{{ curOther }}"><button onClick="{{ curReport }}" style="height: 36px; padding: 0 12px; border: 1px solid #383836; border-radius: 6px; background: transparent; color: #A3A19B; font-size: 13px">通報する</button></sc-if>
<sc-if value="{{ curMine }}"><button onClick="{{ curDelete }}" style="height: 36px; padding: 0 12px; border: 1px solid #383836; border-radius: 6px; background: transparent; color: #FF5C66; font-size: 13px">投稿を削除</button></sc-if>
</div>
'''
rep('<div style="font-size: 14px; color: #A3A19B; padding: 8px 0">この観点のフィードバックはまだありません。</div>\n</sc-if>\n</div>', '<div style="font-size: 14px; color: #A3A19B; padding: 8px 0">この観点のフィードバックはまだありません。</div>\n</sc-if>\n' + CM + '</div>')
# ペインを記録
rline('placeholder="例：授業の空きコマに入れるバイトが見つからない"', lambda l: l.replace('<textarea ', '<textarea id="painText" '))
rline('placeholder="例：学部1〜2年"', lambda l: l.replace('<input ', '<input id="painWho" '))
rline('>#学生生活</span>', '<input id="painTags" type="text" placeholder="例：学生生活 雇用（スペース区切り）" style="height: 48px; background: #131313; border: 1px solid #383836; border-radius: 8px; color: #F3F1EC; padding: 0 14px; font-size: 15px; width: 100%">')
# 投稿する
rline('placeholder="例：学内の落とし物を写真で共有するアプリ"', lambda l: l.replace('<input ', '<input id="npTitle" '))
rline('placeholder="どんな課題を、どう解決するか"', lambda l: l.replace('<textarea ', '<textarea id="npSummary" '))
rline('placeholder="例：自分なら使う？"', lambda l: l.replace('<input ', '<input id="npAsk1" '))
rline('placeholder="例：既存の窓口で十分では？"', lambda l: l.replace('<input ', '<input id="npAsk2" '))
rep('<span style="display: flex; flex-direction: column"><span style="font-weight: 500">元になったペイン</span><span style="font-size: 13px; color: #A3A19B">任意</span></span>\n<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>',
    '<span style="display: flex; flex-direction: column; flex: 1; gap: 8px"><span style="font-weight: 500">元になったペイン <span style="font-size: 13px; color: #A3A19B">任意</span></span><select id="npPain" style="height: 44px; background: #131313; border: 1px solid #383836; border-radius: 8px; color: #F3F1EC; padding: 0 10px; font-size: 15px; width: 100%"><option value="">選ばない</option><sc-for list="{{ painOpts }}" as="p"><option value="{{ p.text }}">{{ p.text }}</option></sc-for></select></span>')
# イベントを共有
rline('placeholder="例：学生起業家ミートアップ"', lambda l: l.replace('<input ', '<input id="enTitle" '))
rline('placeholder="企業・団体名"', lambda l: l.replace('<input ', '<input id="enHost" '))
rline('placeholder="例：12.05"', lambda l: l.replace('<input ', '<input id="enDue" ').replace('placeholder="例：12.05"', 'placeholder="例：2026-12-05"'))
rline('placeholder="https://"', lambda l: l.replace('<input ', '<input id="enUrl" '))
rline('placeholder="おすすめの理由、参加した感想など"', lambda l: l.replace('<textarea ', '<textarea id="enNote" '))

# ---------- 予定 ----------
rep('<h1 class="en" style="margin: 0; font-size: 28px; font-weight: 700">2026.11</h1>', '<h1 class="en" style="margin: 0; font-size: 28px; font-weight: 700">{{ calTitle }}</h1>')
rep('<button class="ibtn" aria-label="前の月">', '<button class="ibtn" onClick="{{ calPrev }}" aria-label="前の月">')
rep('<button class="ibtn" aria-label="次の月">', '<button class="ibtn" onClick="{{ calNext }}" aria-label="次の月">')
i = s.index('<button class="card" style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 8px; color: #F3F1EC; width: 100%; text-align: left">\n<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#BDBAB3" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8')
j = s.index('</button>', s.index('Googleカレンダーと同期', i)) + len('</button>')
s = s[:i] + s[j:]

# ---------- マイページ ----------（モックの方で作り直したので置きかえなし）

# ---------- ヘッダー ----------
rep('<span class="mode"><span>運営</span><button class="msw" data-to="admin.html" role="switch" aria-checked="false" aria-label="運営画面に切り替える"><i></i></button></span>', '<sc-if value="{{ isOps }}"><span class="mode"><span>運営</span><button class="msw" data-to="admin.html" role="switch" aria-checked="false" aria-label="運営画面に切り替える"><i></i></button></span></sc-if>')
rline('aria-label="マイページ"', lambda l: l, 2)
tpl_i = s.index('<template id="tpl">')
k = s.index('>YT</span>', tpl_i); s = s[:k] + '>{{ meIni }}</span>' + s[k + len('>YT</span>'):]
NOTIFPAGE = """<sc-if value="{{ nPop }}" hint-placeholder-val="{{ false }}">
<div onClick="{{ closeNotifs }}" class="npbg"></div>
<div class="nppanel" role="dialog" aria-label="通知">
<div class="nphead"><span>通知</span><sc-if value="{{ hasNotifs }}"><button onClick="{{ delAllNotifs }}">すべて削除</button></sc-if></div>
<div class="nplist">
<sc-for list="{{ notifsAll }}" as="n">
<div class="npi" style="border-bottom: {{ n.sep }}">
<span class="npdot" style="background: {{ n.dot }}"></span>
<span class="npt"><span>{{ n.text }}</span><small>{{ n.sub }} · {{ n.at }}</small></span>
<button onClick="{{ n.del }}" aria-label="このお知らせを削除"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
</div>
</sc-for>
<sc-if value="{{ noNotifs }}"><div class="npempty">お知らせはありません</div></sc-if>
</div>
</div>
</sc-if>
"""
# 通知のポップアップはモックの方に入れた

# ---------- テンプレートエンジン：入力イベントとカーソル位置の保持 ----------
rep("if(n==='onclick'){ var fn=raw(v,sc); if(typeof fn==='function')el.addEventListener('click',fn); continue; }",
    "if(n==='onclick'){ var fn=raw(v,sc); if(typeof fn==='function')el.addEventListener('click',fn); continue; }\n      if(n==='oninput'){ var fi=raw(v,sc); if(typeof fi==='function')el.addEventListener('input',fi); continue; }")
rep("    var inputs=[].map.call(stage.querySelectorAll('input,textarea'),function(e){return e.value;});",
    "    var inputs=[].map.call(stage.querySelectorAll('input,textarea,select'),function(e){return e.value;});\n    var allIn=[].slice.call(stage.querySelectorAll('input,textarea')), fx=allIn.indexOf(document.activeElement), fs=fx>=0?[document.activeElement.selectionStart,document.activeElement.selectionEnd]:null;")
rep("      var ins=stage.querySelectorAll('input,textarea'); if(ins.length===inputs.length)[].forEach.call(ins,function(e,i){ e.value=inputs[i]; });",
    "      var ins=stage.querySelectorAll('input,textarea,select'); if(ins.length===inputs.length)[].forEach.call(ins,function(e,i){ e.value=inputs[i]; });\n      if(fx>=0){ var nf=stage.querySelectorAll('input,textarea')[fx]; if(nf){ nf.focus(); try{ nf.setSelectionRange(fs[0],fs[1]); }catch(e){} } }")
rep("    comp=new Component({}); fit(); render();", "    comp=window.__comp=new Component({}); fit(); render();")
rep("window.__boot(Component);", """const __rv0 = Component.prototype.renderVals;
Component.prototype.renderVals = function () { const v = __rv0.call(this); return Object.assign(v, memberExtras.call(this, v)); };
window.__boot(Component);
window.__memberBoot();""")
# 初期状態：ロール・募集の初期値をなくす
rep("joined: { e4: true }", "joined: {}")
rep("npRoles: { Engineer: true }", "npRoles: {}")
rep("npEnd: 0", "npEnd: null")

# ---------- PC 用の左下アカウント表示 ----------
k = s.index('<button class="wme"'); k2 = s.index('</button>', k) + len('</button>')
s = s[:k] + '<button class="wme" onclick="var b=document.querySelector(\'#stage button[aria-label=&quot;マイページ&quot;]\');if(b)b.click();"><span class="av" id="wAv">?</span><span><b style="font-weight:700" id="wName"></b><small id="wSub"></small></span></button>' + s[k2:]
rep('<div class="mode"><span>運営</span><button class="msw" data-to="admin.html"', '<div class="mode" id="wMode" style="display:none"><span>運営</span><button class="msw" data-to="admin.html"')

# ---------- 読み込み ----------
CSS = '''
#mgate{position:fixed;inset:0;z-index:1000;background:#070707;color:#F3F1EC;display:flex;align-items:center;justify-content:center;padding:24px;font-family:inherit}
#mgate .gc{width:100%;max-width:360px;display:flex;flex-direction:column;gap:14px}
#mgate .glg{display:flex;align-items:center;gap:10px;margin-bottom:18px}
#mgate .glg b{letter-spacing:.16em;font-size:18px}
#mgate h1{margin:0;font-size:24px}
#mgate .gs{margin:0 0 8px;color:#BDBAB3;font-size:14px;line-height:1.7}
#mgate .gb,#mgate .gp{height:50px;border-radius:8px;border:0;background:#F3F1EC;color:#070707;font-weight:700;font-size:15px;display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer}
#mgate .gl{height:44px;border-radius:8px;border:1px solid #383836;background:transparent;color:#D2CFC8;font-size:14px;cursor:pointer}
#mgate .gf{display:flex;flex-direction:column;gap:6px;font-size:13px;color:#A3A19B}
#mgate .gf input{height:48px;border-radius:8px;border:1px solid #383836;background:#131313;color:#F3F1EC;padding:0 14px;font-size:16px}
#mgate .gm{min-height:1em;font-size:13px;color:#FF5C66;margin:0}
#mgate .gm.ok{color:#BDBAB3}
#mtoast{position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom));transform:translate(-50%,20px);background:#F3F1EC;color:#070707;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:700;opacity:0;pointer-events:none;transition:all .2s;z-index:1001;max-width:86vw;text-align:center}
#mtoast.on{opacity:1;transform:translate(-50%,0)}
'''
rep('</style>\n</head>', CSS + '</style>\n</head>')
rep('<head>', '<head>\n<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js"></script>', 1)
CHROME = '''
// PC の左下アカウント表示を本人の情報に
window.__chrome = function () { var D = window.DB; if (!D || !D.self) return; var a = document.getElementById('wAv'), n = document.getElementById('wName'), sb2 = document.getElementById('wSub'), m = document.getElementById('wMode');
  if (a) a.textContent = D.ini(D.me); if (n) n.textContent = D.self.name; if (sb2) sb2.textContent = D.self.grade || ''; if (m) m.style.display = D.isOps() ? '' : 'none'; };
setInterval(window.__chrome, 400);
'''
k = s.index('<div id="stage"></div>')
s = s[:k] + '<script>\n' + MJS + CHROME + '\n</script>\n' + s[k:]
SNIP = "\n<script>\n// 新しい版が出ていたら、キャッシュを避けて読み直す（GitHub Pages は最大10分キャッシュするため）\n(function () {\n  var VER = '__VER__', FILE = '__FILE__';\n  function check() {\n    fetch(FILE + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (v) {\n      v = (v || '').trim(); if (!v || v === VER) return;\n      var q = new URLSearchParams(location.search); if (q.get('v') === v) return;\n      q.set('v', v); location.replace(location.pathname + '?' + q.toString() + location.hash);\n    }).catch(function () {});\n  }\n  check(); document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });\n})();\n</script>\n"

import hashlib
def stamp(s, page, verfile):
    v = hashlib.sha1(s.encode()).hexdigest()[:10]
    s = s.replace('<head>', '<head>' + SNIP.replace('__VER__', v).replace('__FILE__', verfile), 1)
    open(verfile, 'w').write(v + '\n')
    return s

import theme; s, _tm = theme.apply(s)  # 色をテーマ（CSS変数）で変えられるように
s = stamp(s, 'index.html', 'index.ver')
s = s.replace('</head>', '<script>if ("serviceWorker" in navigator) window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });</script>\n</head>', 1)
s = s.replace('<html', '<html data-prod="1"', 1)  # 本番：起動ロゴは読み込みが終わるまで出す
open('index.html', 'w').write(s)
print('built member index.html', len(s))

