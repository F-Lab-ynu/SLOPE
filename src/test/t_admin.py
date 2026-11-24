# フォルダー型の運営画面（本番ビルド）を偽の Supabase で確かめる
import asyncio, json, http.server, threading, functools, os
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PORT = 8766
srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT))
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
threading.Thread(target=srv.serve_forever, daemon=True).start()
FAKE = open(ROOT + '/src/test/fake-supabase.js').read()
A = '11111111-1111-1111-1111-111111111111'; B = '22222222-2222-2222-2222-222222222222'; C = '33333333-3333-3333-3333-333333333333'
SEED = {'profiles': [
  {'id': A, 'name': '池内 完輔', 'email': 'a@x', 'grade': '経営 1年', 'post': '代表', 'roles': [], 'approved': True, 'created_at': '2026-01-01'},
  {'id': B, 'name': '部長 太郎', 'email': 'b@x', 'grade': '', 'post': '教育部', 'roles': [], 'approved': True, 'created_at': '2026-01-02'},
  {'id': C, 'name': '新入 花子', 'email': 'c@x', 'grade': '', 'post': '—', 'roles': [], 'approved': False, 'created_at': '2026-01-03'}],
  'nodes': [], 'notifications': [],
  'items': [{'id': 'T1', 'kind': 'track', 'author': A, 'data': {'name': '基礎教育', 'text': 'U1 あ', 'status': 'pub', 'units': {}}, 'state': 'ok', 'pos': 0, 'created_at': '2026-11-16'}]}
async def page_as(b, me, vp, errs, path='admin.html'):
    pg = await b.new_page(viewport=vp)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.route('**/supabase-js@*/**', lambda r: r.fulfill(body=FAKE, content_type='application/javascript'))
    await pg.goto(f'http://127.0.0.1:{PORT}/{path}')
    return pg
async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await page_as(b, A, dict(width=1440, height=900), errs)
        await pg.evaluate(f"localStorage.clear(); localStorage.setItem('__fakedb', {json.dumps(json.dumps(SEED))}); localStorage.setItem('__fakeme','{A}')")
        await pg.reload(); await pg.wait_for_timeout(700)
        await pg.click('[data-act=go][data-view=projects]'); await pg.wait_for_timeout(300)
        # 一番上にフォルダー
        await pg.click('.fadd'); await pg.click('.fadd [data-act=newF]'); await pg.wait_for_timeout(300)
        await pg.keyboard.press('Control+A'); await pg.keyboard.type('2026起業部'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(500)
        await pg.click('.fcard:has-text("2026起業部") .fct'); await pg.wait_for_timeout(300)
        # 自分をリーダーに
        await pg.click('.fh2r .tbtn'); await pg.wait_for_timeout(200)
        await pg.locator('#tp input[type=checkbox]').nth(0).check(); await pg.wait_for_timeout(300)
        await pg.click('.fh2'); await pg.wait_for_timeout(200)
        await pg.click('.fadd'); await pg.click('.fadd [data-act=newF]'); await pg.wait_for_timeout(300)
        await pg.keyboard.press('Control+A'); await pg.keyboard.type('MIRA 2026'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(400)
        await pg.click('.fadd'); await pg.click('.fadd [data-act=newT]'); await pg.wait_for_timeout(300)
        await pg.keyboard.press('Control+A'); await pg.keyboard.type('会場の予約'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(400)
        await pg.click('.fcard:has-text("会場の予約")'); await pg.wait_for_timeout(300)
        await pg.click('#fdoc'); await pg.keyboard.type('-'); await pg.keyboard.press('Space'); await pg.keyboard.type('A会館に電話'); await pg.click('.fh2'); await pg.wait_for_timeout(900)
        await pg.click('.crumb button:has-text("2026起業部")'); await pg.wait_for_timeout(300)
        db = json.loads(await pg.evaluate("localStorage.getItem('__fakedb')"))
        rows = {n['title']: n for n in db['nodes']}
        print('nodes', sorted(rows), 'root kind', rows.get('2026起業部', {}).get('kind'), 'leads', rows.get('2026起業部', {}).get('data'), 'mira', rows.get('MIRA 2026', {}).get('data'), 'file memo', rows.get('会場の予約', {}).get('data'))
        await pg.click('[data-act=fmode][data-v=gantt]'); await pg.wait_for_timeout(400)
        print('gantt rows', await pg.locator('.gg .gr[data-row]').count())
        await pg.reload(); await pg.wait_for_timeout(800)
        await pg.click('[data-act=go][data-view=projects]'); await pg.wait_for_timeout(300)
        print('after reload h2', await pg.locator('.fh2r h2').text_content(), 'mira folder?', await pg.locator('.fcard.isfc:has-text("MIRA 2026"), .gname:has-text("MIRA 2026")').count())
        await pg.click('[data-act=go][data-view=perms]'); await pg.wait_for_timeout(300)
        print('pending box', await pg.locator('.pendrow').count())
        await pg.click('[data-act=go][data-view=dash]'); await pg.wait_for_timeout(300)
        await pg.evaluate("window.notify(S_ME_PLACEHOLDER, 'テスト通知', 'x')".replace('S_ME_PLACEHOLDER', "document.querySelector('.acct') ? '' : ''")) if False else None
        await pg.evaluate("(()=>{ window.notify && 0; })()")
        nb = await pg.locator('.nclr').count()
        if nb: await pg.click('.nclr'); await pg.wait_for_timeout(1500)
        print('notif all:', nb, await pg.locator('.nr2 .nx').count())
        await pg.screenshot(path='/home/claude/audit/p_dash.png')
        await pg.click('[data-act=go][data-view=tracks]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/home/claude/audit/p_tracks.png')
        await pg.click('.p2tb [data-p2a=nf]'); await pg.wait_for_timeout(200); await pg.keyboard.type('仕上げ'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
        await pg.click('[data-p2a=nu]'); await pg.wait_for_timeout(200); await pg.keyboard.type('最終発表'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1500)
        print('program saved:', await pg.evaluate("(function(){var d=JSON.parse(localStorage.getItem('__fakedb')).items.filter(function(x){return x.kind==='program'})[0];return d?JSON.stringify(d.data.v2.map(function(n){return n.name||n.c})):'none'})()"))
        print('unit saved:', await pg.evaluate("JSON.parse(localStorage.getItem('__fakedb')).items.filter(function(x){return x.kind==='track'}).map(function(x){return x.data.name+':'+(x.data.list||[]).map(function(u){return u.title}).join('/')}).join(' | ')"))
        await pg.screenshot(path='/home/claude/audit/p_tracks2.png')
        await pg.wait_for_timeout(3500)
        fr = pg.frame_locator('#p2pvf iframe')
        fr2 = [f for f in pg.frames if 'embed' in f.url]; print('frame url:', [f.url for f in pg.frames]); print('tab:', await fr2[0].evaluate('window.__comp && window.__comp.state.tab') if fr2 else None)
        print('embed program rows:', await fr.locator('.pgu, .pgbh').count(), 'final:', await fr.locator('.pgu:has-text("最終発表")').count())
        await pg.screenshot(path='/home/claude/audit/p_tracks3.png')
        # 部員画面
        m = await page_as(b, A, dict(width=390, height=844), errs, '')
        await m.wait_for_timeout(900)
        await m.screenshot(path='/home/claude/audit/p_member.png')
        print('errors', errs)
        await b.close()
asyncio.run(main())
