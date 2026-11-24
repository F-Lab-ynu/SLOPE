import asyncio, json, http.server, threading, functools
from playwright.async_api import async_playwright
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); PORT = 8766
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
FAKE = open(ROOT + '/src/test/fake-supabase.js').read()
A = '11111111-1111-1111-1111-111111111111'; B = '22222222-2222-2222-2222-222222222222'; C = '33333333-3333-3333-3333-333333333333'
TRACK = {'name': 'Strategist', 'owner': '', 'status': 'pub', 'start': '基礎教育 修了', 'goal': 'MIRA', 'updated': '', 'text': '', 'units': {'ST1': {'practice': '', 'milestone': '業界を説明できる', 'materials': [{'url': 'https://example.com/a', 'memo': '業界レポートの読み方', 'type': '記事'}]}},
         'list': [{'code': 'ST1', 'title': '社会情勢と業界', 'tags': [], 'deps': []}, {'code': 'ST2', 'title': '戦略理論', 'tags': ['実習'], 'deps': ['ST1']}]}
BASE = {'name': '基礎教育', 'status': 'pub', 'start': '入部', 'goal': 'LUNA', 'units': {}, 'list': [{'code': 'B1', 'title': '起業の地図', 'tags': [], 'deps': []}]}
SEED = {'profiles': [
  {'id': A, 'name': '池内 完輔', 'email': 'a@x', 'grade': '経営 1年', 'post': '代表', 'roles': ['Strategist'], 'approved': True, 'created_at': '2026-01-01'},
  {'id': B, 'name': '部員 花子', 'email': 'b@x', 'grade': '理工 1年', 'post': '—', 'roles': [], 'approved': True, 'created_at': '2026-01-02'},
  {'id': C, 'name': '新入 太郎', 'email': 'c@x', 'grade': '', 'post': '—', 'roles': [], 'approved': False, 'created_at': '2026-01-03'}],
  'nodes': [
  {'id': 'pj1', 'parent_id': None, 'pos': 0, 'title': 'MIRA 2026', 'kind': 'event', 'announce': 'done', 'reg': 0, 'unit': '教育部', 'who': A, 'team': [A], 'start_date': '2026-11-01', 'end_date': '2026-11-28', 'done': False},
  {'id': 'k1', 'parent_id': 'pj1', 'pos': 0, 'title': '審査の準備', 'who': A, 'team': [A, B], 'start_date': '2026-11-01', 'end_date': '2026-11-20', 'done': False},
  {'id': 'k2', 'parent_id': 'k1', 'pos': 0, 'title': '審査員を探す', 'who': B, 'team': [], 'start_date': '2026-11-10', 'end_date': '2026-11-19', 'done': False}],
  'notifications': [{'id': 'nt1', 'to_id': B, 'text': '「審査員を探す」の担当になりました', 'sub': 'MIRA 2026', 'read': False, 'created_at': '2026-11-20T00:00:00Z'}], 'reactions': [], 'reports': [],
  'items': [{'id': 't1', 'kind': 'track', 'data': TRACK, 'state': 'ok', 'pos': 1, 'author': A, 'created_at': '2026-11-01T00:00:00Z'},
            {'id': 't0', 'kind': 'track', 'data': BASE, 'state': 'ok', 'pos': 0, 'author': A, 'created_at': '2026-11-01T00:00:00Z'},
            {'id': 'n1', 'kind': 'notice', 'data': {'type': 'ビジコン', 'title': '学生ビジコン', 'host': '某財団', 'due': '2026-12-05', 'url': 'https://example.com', 'memo': '', 'state': 'pub'}, 'state': 'ok', 'pos': 0, 'author': A, 'created_at': '2026-11-10T00:00:00Z'}]}

async def page_as(b, me, vp, errs):
    pg = await b.new_page(viewport=vp, device_scale_factor=2 if vp['width'] < 500 else 1, has_touch=vp['width'] < 500)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.route('**/supabase-js@*/**', lambda r: r.fulfill(body=FAKE, content_type='application/javascript'))
    await pg.route('**/s3.tradingview.com/**', lambda r: r.abort())
    await pg.goto(f'http://127.0.0.1:{PORT}/index.html')
    await pg.evaluate(f"localStorage.clear(); localStorage.setItem('__fakedb', {json.dumps(json.dumps(SEED))}); " + (f"localStorage.setItem('__fakeme','{me}')" if me else ''))
    await pg.reload(); await pg.wait_for_timeout(700)
    return pg

def db(pg, k): return pg.evaluate(f"JSON.parse(localStorage.getItem('__fakedb')).{k}")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        errs = []
        pg = await page_as(b, None, {'width': 390, 'height': 844}, errs)
        print('login gate:', await pg.locator('#mgate #gLogin').count()); await pg.screenshot(path='/tmp/m0.png')
        pg = await page_as(b, C, {'width': 390, 'height': 844}, errs)
        print('pending gate:', await pg.locator('#mgate #gName').count())
        # 部員Bでホーム
        pg = await page_as(b, B, {'width': 390, 'height': 844}, errs)
        print('gate gone:', await pg.locator('#mgate').count() == 0)
        await pg.screenshot(path='/tmp/m1.png', full_page=True)
        txt = await pg.locator('#stage').inner_text()
        print('home has task:', '審査員を探す' in txt, 'hello:', 'こんにちは、部員 花子さん' in txt, 'no sample:', '山田' not in txt and 'MIRA エントリー締切' not in txt)
        await pg.get_by_text('完了', exact=True).first.click(); await pg.wait_for_timeout(400)
        print('task done:', [n['done'] for n in await db(pg, 'nodes') if n['id'] == 'k2'], 'notified A:', [n['text'] for n in await db(pg, 'notifications')])
        # 掲示板：投稿
        await pg.click('#stage nav button:has-text("掲示板")'); await pg.wait_for_timeout(200)
        await pg.click('#stage button:has-text("投稿する")'); await pg.wait_for_timeout(200)
        await pg.fill('#npTitle', '学食の混雑を見える化'); await pg.fill('#npSummary', '昼休みの混雑を分散させたい')
        await pg.fill('#npAsk1', '使う？')
        await pg.click('#stage button:has-text("意見を募集する")'); await pg.wait_for_timeout(400)
        items = await db(pg, 'items'); print('idea posted:', [(i['kind'], i['data'].get('title')) for i in items if i['kind'] == 'idea'])
        await pg.screenshot(path='/tmp/m2.png')
        # メンバー募集
        await pg.click('#stage button:has-text("投稿する")'); await pg.wait_for_timeout(200)
        await pg.click('#stage button:has-text("メンバー募集")'); await pg.wait_for_timeout(100)
        await pg.fill('#npTitle', '空きコマバイト'); await pg.fill('#npSummary', '時間割から提案')
        await pg.click('#stage button:has-text("Engineer")'); await pg.click('#stage button:has-text("事業の存続が不可能")')
        await pg.screenshot(path='/tmp/m2b.png', full_page=True)
        await pg.click('#stage button:has-text("メンバーを募集する")'); await pg.wait_for_timeout(400)
        print('toast:', await pg.evaluate("(document.getElementById('mtoast')||{}).textContent"))
        rec = [i for i in await db(pg, 'items') if i['kind'] == 'recruit']; print('recruit:', [(r['data']['title'], r['data']['roles']) for r in rec])
        # 詳細とコメント
        await pg.click('#stage button:has-text("学食の混雑を見える化")'); await pg.wait_for_timeout(300)
        await pg.fill('#cmText', 'まずアンケートを取るといい'); await pg.click('#stage button:has-text("送信")'); await pg.wait_for_timeout(400)
        print('comment:', [(i['kind'], i['parent_id'] is not None) for i in await db(pg, 'items') if i['kind'] == 'comment'])
        await pg.screenshot(path='/tmp/m3.png', full_page=True)
        await pg.click('#stage button[aria-label="戻る"]'); await pg.wait_for_timeout(200)
        # ペイン
        await pg.click('#stage button:has-text("ペイン")'); await pg.wait_for_timeout(200)
        await pg.click('#stage button:has-text("ペインを記録")'); await pg.wait_for_timeout(200)
        await pg.fill('#painText', '昼休みの学食が混む'); await pg.fill('#painWho', '学部生'); await pg.fill('#painTags', '学生生活 食事')
        await pg.click('#stage button:has-text("記録する")'); await pg.wait_for_timeout(400)
        await pg.click('#stage button[aria-label="共感する"]'); await pg.wait_for_timeout(300)
        print('pain + emp:', [i['data']['tags'] for i in await db(pg, 'items') if i['kind'] == 'pain'], len(await db(pg, 'reactions')))
        await pg.screenshot(path='/tmp/m4.png')
        # イベント
        await pg.click('#stage button:has-text("イベント")'); await pg.wait_for_timeout(200)
        await pg.screenshot(path='/tmp/m5.png')
        await pg.click('#stage button:has-text("予定に追加")'); await pg.wait_for_timeout(300)
        # その他
        await pg.click('#stage button:has-text("フリー")'); await pg.wait_for_timeout(200)
        await pg.fill('#otText', '定例会のあとご飯行く人'); await pg.click('#stage button[aria-label="投稿"]'); await pg.wait_for_timeout(400)
        print('other:', [i['data'] for i in await db(pg, 'items') if i['kind'] == 'other'])
        # 予定
        await pg.click('#stage nav button:has-text("予定")'); await pg.wait_for_timeout(300)
        await pg.click('#stage nav button:has-text("ホーム")'); await pg.wait_for_timeout(300)
        dot = lambda: pg.evaluate("getComputedStyle(document.querySelector('#stage button[aria-label=通知] span')||document.body).display")
        print('bell dot before:', await dot())
        await pg.click('#stage button[aria-label="通知"]'); await pg.wait_for_timeout(1600)
        print('notif page:', await pg.locator('#stage :text("通知")').count() > 0, '| dot after:', await dot())
        nb = await pg.locator('#stage button[aria-label="このお知らせを削除"]').count()
        if nb: await pg.locator('#stage button[aria-label="このお知らせを削除"]').first.click(); await pg.wait_for_timeout(300)
        await pg.evaluate("history.back()") if False else None
        print('notif del:', nb, '->', await pg.locator('#stage button[aria-label="このお知らせを削除"]').count(), len(await db(pg, 'notifications')))
        await pg.screenshot(path='/tmp/npop.png'); await pg.click('.npbg', position={'x': 20, 'y': 400})
        await pg.wait_for_timeout(300); print('read all:', all(n['read'] for n in await db(pg, 'notifications') if n['to_id'] == B))
        await pg.click('#stage nav button:has-text("予定")'); await pg.wait_for_timeout(300)
        print('club events:', await pg.locator('#stage h2:has-text("部内イベント")').count(), await pg.locator('#stage :text("これからの部内イベントはありません")').count())
        await pg.screenshot(path='/tmp/m6.png')
        # 学ぶ
        await pg.click('#stage nav button:has-text("学ぶ")'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/m7.png', full_page=True)
        await pg.click('#stage button:has-text("起業の地図")'); await pg.wait_for_timeout(300)
        await pg.click('#stage button:has-text("修了にする")'); await pg.wait_for_timeout(300)
        print('unit done:', [(r['item_id'], r['kind']) for r in await db(pg, 'reactions') if r['kind'] == 'done'])
        await pg.screenshot(path='/tmp/m8.png')
        # マイページ
        await pg.click('#stage button[aria-label="戻る"]'); await pg.wait_for_timeout(200)
        print('after done:', await pg.locator('#stage .pgu .pgd.done').count(), 'folders:', await pg.locator('#stage .pgbh').count())
        await pg.screenshot(path='/tmp/m7b.png', full_page=True)
        await pg.click('#stage button[aria-label="マイページ"]'); await pg.wait_for_timeout(300)
        await pg.click('#stage button:has-text("Negotiator")'); await pg.wait_for_timeout(400)
        print('roles:', [p['roles'] for p in await db(pg, 'profiles') if p['id'] == B], 'ops section shown:', await pg.locator('#stage a[href="admin.html"]').count())
        await pg.screenshot(path='/tmp/m9.png', full_page=True)
        # PC 表示（代表）
        pc = await page_as(b, A, {'width': 1440, 'height': 900}, errs)
        await pc.screenshot(path='/tmp/m10.png')
        print('PC ops switch:', await pc.evaluate("getComputedStyle(document.getElementById('wMode')).display"))
        print('errors:', errs)
        await b.close()
asyncio.run(main())
