# レベル（印を付けたイベントの出席）と確認問題（全問正解で単元達成）
import asyncio, json, sys, os
sys.argv = ['x']
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 't_member.py')).read()
exec(src[:src.index('async def main():')])
UNITS = {'ST1': {'materials': [{'url': 'https://blog.bizboost.co.jp/list-of-famous-marketing-theories-analysis-methods-and-ideas-also-recommended-books-to-deepen-your', 'memo': 'https://blog.bizboost.co.jp/list-of-famous-marketing-theories-analysis-methods-and-ideas-also-recommended-books-to-deepen-your', 'type': '記事'}, {'url': 'https://docs.google.com/document/d/1u8CXYu39WiYOk_DdF5yNOl2eEMoKw8wVm1Ac5E8O1eg/edit?usp=sharing', 'memo': 'とても長い題名の教材がここに入った場合にどう折り返されて表示されるのかを確かめるための例です', 'type': '資料'}], 'quiz': [{'q': '3Cとは', 'c': ['顧客・競合・自社', '費用・品質・納期'], 'a': 0}, {'q': 'MIRAは何年の何月', 'c': ['1年11月', '2年5月'], 'a': 0}]}}
SEED['items'] = [x for x in SEED['items'] if x['kind'] not in ('program',)]
for x in SEED['items']:
    if x['id'] == 't1': x['data'] = dict(x['data'], units=UNITS)
V2 = [{'id': 'f1', 'k': 'f', 'name': 'Strategist', 't': 't1', 'items': [{'id': 'u1', 'k': 'u', 't': 't1', 'c': 'ST1'}]},
      {'id': 'e1', 'k': 'e', 'ref': 'cL', 'lv': True, 'name': 'LUNA'}, {'id': 'e2', 'k': 'e', 'ref': 'cM', 'lv': True, 'name': 'MIRA'},
      {'id': 'out', 'k': 'f', 'out': True, 'name': 'プログラム外', 'items': []}]
SEED['items'] += [{'id': 'program', 'kind': 'program', 'data': {'v2': V2}, 'state': 'ok', 'pos': 0, 'author': A, 'created_at': '2026-11-01T00:00:00Z'},
  {'id': 'cL', 'kind': 'cal', 'data': {'title': 'LUNA', 'date': '2026-06-10', 'state': 'pub', 'att': [B]}, 'state': 'ok', 'pos': 0, 'author': A, 'created_at': '2026-11-01T00:00:00Z'},
  {'id': 'cM', 'kind': 'cal', 'data': {'title': 'MIRA', 'date': '2026-11-10', 'state': 'pub', 'att': []}, 'state': 'ok', 'pos': 0, 'author': A, 'created_at': '2026-11-01T00:00:00Z'}]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        errs = []
        pg = await page_as(b, B, {'width': 390, 'height': 844}, errs)
        await pg.evaluate("document.querySelector('#stage button[aria-label=\"マイページ\"]').click()"); await pg.wait_for_timeout(400)
        t = await pg.locator('#stage').inner_text()
        print('lv chip:', 'Lv1' in t, '| ms chip:', 'Strategist 0/1' in t)
        await pg.evaluate("location.search='?tab=learn'"); await pg.wait_for_timeout(1200)
        await pg.click('[data-pgu="ST1"]'); await pg.wait_for_timeout(500); await pg.screenshot(path='/tmp/mat.png')
        print('quiz shown:', await pg.locator('#uquiz .uqq').count(), '| done button hidden:', await pg.locator('#stage button:has-text("修了にする")').count() == 0)
        await pg.click('[data-uqo="0:0"]'); await pg.click('[data-uqo="1:1"]'); await pg.click('[data-uqgo]'); await pg.wait_for_timeout(300)
        print('wrong -> not done:', not any(r['kind'] == 'done' for r in await db(pg, 'reactions')))
        await pg.click('[data-uqo="1:0"]'); await pg.click('[data-uqgo]'); await pg.wait_for_timeout(600)
        print('right -> done:', [r['item_id'] for r in await db(pg, 'reactions') if r['kind'] == 'done'], '| badge:', await pg.locator('#uquiz .uqok').count())
        await pg.screenshot(path='/tmp/lv_quiz.png')
        print('errors:', errs)
        await b.close()
asyncio.run(main())
