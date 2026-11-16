import asyncio, json, http.server, threading, functools
from playwright.async_api import async_playwright
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PORT = 8765
srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT))
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
threading.Thread(target=srv.serve_forever, daemon=True).start()
FAKE = open(ROOT + '/src/test/fake-supabase.js').read()
A = '11111111-1111-1111-1111-111111111111'; B = '22222222-2222-2222-2222-222222222222'; C = '33333333-3333-3333-3333-333333333333'
SEED = {'profiles': [
  {'id': A, 'name': '池内 完輔', 'email': 'a@x', 'grade': '経営 1年', 'post': '代表', 'roles': [], 'approved': True, 'created_at': '2026-01-01'},
  {'id': B, 'name': '部長 太郎', 'email': 'b@x', 'grade': '', 'post': '教育部', 'roles': [], 'approved': True, 'created_at': '2026-01-02'},
  {'id': C, 'name': '新入 花子', 'email': 'c@x', 'grade': '', 'post': '—', 'roles': [], 'approved': False, 'created_at': '2026-01-03'}],
  'nodes': [
  {'id': 'pj1', 'parent_id': None, 'pos': 0, 'title': 'MIRA 2026', 'kind': 'event', 'announce': 'done', 'reg': 40, 'unit': '教育部', 'who': A, 'team': [A], 'start_date': '2026-10-20', 'end_date': '2026-11-28', 'done': False},
  {'id': 'k1', 'parent_id': 'pj1', 'pos': 0, 'title': '審査の準備', 'kind': None, 'announce': None, 'reg': None, 'unit': None, 'who': B, 'team': [B], 'start_date': '2026-10-20', 'end_date': '2026-11-20', 'done': False},
  {'id': 'k2', 'parent_id': 'k1', 'pos': 0, 'title': '審査員を探す', 'kind': None, 'announce': None, 'reg': None, 'unit': None, 'who': None, 'team': [], 'start_date': '2026-10-27', 'end_date': '2026-11-13', 'done': False}],
  'notifications': []}

async def page_as(b, me, viewport, errs):
    pg = await b.new_page(viewport=viewport)
    pg.on('pageerror', lambda e: errs.append(str(e) + ' | ' + (e.stack or '')[:400]))
    await pg.route('**/supabase-js@*/**', lambda r: r.fulfill(body=FAKE, content_type='application/javascript'))
    await pg.goto(f'http://127.0.0.1:{PORT}/admin.html')
    await pg.evaluate(f"localStorage.clear(); localStorage.setItem('__fakedb', {json.dumps(json.dumps(SEED))}); " + (f"localStorage.setItem('__fakeme','{me}')" if me else ''))
    await pg.reload(); await pg.wait_for_timeout(500)
    return pg

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        errs = []
        # 未ログイン
        pg = await page_as(b, None, {'width': 1280, 'height': 800}, errs)
        print('login gate:', await pg.locator('#gate [data-act=glogin]').count()); await pg.screenshot(path='/tmp/p0.png')
        await pg.click('[data-act=glogin]'); print('oauth called:', await pg.evaluate('!!window.__oauth'))
        # 承認待ち
        pg = await page_as(b, C, {'width': 1280, 'height': 800}, errs)
        print('pending gate:', await pg.locator('#gate #gName').count()); await pg.screenshot(path='/tmp/p1.png')
        # 代表でログイン
        pg = await page_as(b, A, {'width': 1440, 'height': 900}, errs)
        print('gate gone:', await pg.locator('#gate').count() == 0, 'nav:', await pg.evaluate("[...document.querySelectorAll('#nav button')].map(b=>b.dataset.view)"))
        await pg.screenshot(path='/tmp/p2.png')
        await pg.click('[data-view=perms]'); await pg.wait_for_timeout(200); await pg.screenshot(path='/tmp/p3.png')
        await pg.click('[data-act=approve]'); await pg.wait_for_timeout(400)
        print('approved:', await pg.evaluate("JSON.parse(localStorage.getItem('__fakedb')).profiles.find(p=>p.name==='新入 花子').approved"))
        await pg.click('[data-view=projects]'); await pg.wait_for_timeout(300)
        await pg.click('.vbtn'); await pg.click('[data-act=vdepth][data-v="9"]'); await pg.click('[data-act=vclose]'); await pg.wait_for_timeout(200)
        # 追加（Enter）・タイトル編集・削除
        t = pg.locator('.cell[data-c=t][data-id=k2]'); await t.click(); await pg.keyboard.press('End'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
        await pg.keyboard.type('採点シート'); await pg.keyboard.press('Tab'); await pg.wait_for_timeout(600)
        db = await pg.evaluate("JSON.parse(localStorage.getItem('__fakedb')).nodes")
        print('nodes after add:', [(n['title'], n['parent_id'], n['pos']) for n in db])
        await pg.fill('.cell[data-c=t][data-id=k1]', '審査の準備（改）'); await pg.keyboard.press('Tab'); await pg.wait_for_timeout(500)
        db = await pg.evaluate("JSON.parse(localStorage.getItem('__fakedb')).nodes")
        print('renamed:', [n['title'] for n in db if n['id'] == 'k1'])
        await pg.locator('[data-act=rowDel][data-id=k2]').click(force=True); await pg.wait_for_timeout(500)
        db = await pg.evaluate("JSON.parse(localStorage.getItem('__fakedb')).nodes")
        print('after delete:', [n['title'] for n in db])
        await pg.click('[data-act=undoAll]'); await pg.wait_for_timeout(600)
        db = await pg.evaluate("JSON.parse(localStorage.getItem('__fakedb')).nodes")
        print('after undo:', [n['title'] for n in db])
        # 権限エラー時に元へ戻ること
        await pg.evaluate("(()=>{ window.__FAIL = function(q){ return q.op==='update' && q.t==='nodes'; }; })()")
        await pg.fill('.cell[data-c=t][data-id=k1]', 'だめな変更'); await pg.click('.top h1'); await pg.wait_for_timeout(900)
        print('reverted on error:', await pg.locator('.cell[data-c=t][data-id=k1]').input_value(), '/', await pg.locator('#toast').inner_text())
        await pg.evaluate("(()=>{ window.__FAIL = null; })()")
        # 他の人の変更（リアルタイム）
        await pg.evaluate("(()=>{const d=JSON.parse(localStorage.getItem('__fakedb'));d.nodes.push({id:'kx',parent_id:'pj1',pos:5,title:'他の人が追加',who:null,team:[],start_date:'2026-11-01',end_date:'2026-11-10',done:false});localStorage.setItem('__fakedb',JSON.stringify(d));__DB.nodes=d.nodes;})()")
        await pg.evaluate("document.activeElement.blur(); window.__RT.forEach(f=>f({}))"); await pg.wait_for_timeout(900)
        print('remote row shown:', await pg.locator('.cell[data-c=t][data-id=kx]').count())
        await pg.screenshot(path='/tmp/p4.png')
        # 通知（担当を設定）
        await pg.click('[data-act=utab][data-v=gantt]'); await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/p5.png')
        # 部長（非代表）
        pg2 = await page_as(b, B, {'width': 1440, 'height': 900}, errs)
        print('B nav:', await pg2.evaluate("[...document.querySelectorAll('#nav button')].map(b=>b.dataset.view)"))
        # ログアウト
        await pg2.click('[data-act=acct]'); await pg2.click('[data-act=logout]'); await pg2.wait_for_timeout(500)
        print('after logout gate:', await pg2.locator('#gate [data-act=glogin]').count())
        # 教材・告知・掲示板（代表）
        pa = await page_as(b, A, {'width': 1440, 'height': 900}, errs)
        await pa.click('[data-view=tracks]'); await pa.wait_for_timeout(200)
        await pa.click('[data-act=newTrack]'); await pa.wait_for_timeout(300)
        await pa.fill('#units .cell[data-u=new]', '社会情勢と業界'); await pa.press('#units .cell[data-u=new]', 'Enter'); await pa.wait_for_timeout(600)
        it = await pa.evaluate("JSON.parse(localStorage.getItem('__fakedb')).items")
        print('track saved:', [(x['kind'], x['data'].get('name'), len(x['data'].get('list', []))) for x in it if x['kind'] == 'track'])
        await pa.click('[data-view=notices]'); await pa.wait_for_timeout(200)
        await pa.fill('.cell[data-n=new]', '学生ビジコン'); await pa.press('.cell[data-n=new]', 'Enter'); await pa.wait_for_timeout(500)
        await pa.locator('.sw[data-act=nState]').first.click(); await pa.wait_for_timeout(500)
        it = await pa.evaluate("JSON.parse(localStorage.getItem('__fakedb')).items")
        print('notice saved:', [(x['data'].get('title'), x['data'].get('state')) for x in it if x['kind'] == 'notice'])
        await pa.evaluate("(()=>{const d=JSON.parse(localStorage.getItem('__fakedb'));d.items.push({id:'p9',kind:'other',data:{text:'怪しい勧誘',tag:'雑談'},state:'ok',pos:0,author:'%s',created_at:new Date().toISOString()});d.reports.push({id:1,item_id:'p9',user_id:'%s',reason:'勧誘・宣伝'});localStorage.setItem('__fakedb',JSON.stringify(d));})()" % (B, A))
        await pa.reload(); await pa.wait_for_timeout(600)
        await pa.click('[data-view=board]'); await pa.wait_for_timeout(300)
        await pa.screenshot(path='/tmp/p7.png')
        await pa.locator('[data-act=pHide]').first.click(); await pa.wait_for_timeout(500)
        it = await pa.evaluate("JSON.parse(localStorage.getItem('__fakedb')).items")
        print('hidden:', [x['state'] for x in it if x['id'] == 'p9'])
        m = await page_as(b, A, {'width': 390, 'height': 844}, errs)
        await m.screenshot(path='/tmp/p6.png')
        print('errors:', errs); print('log tail:', (await pg.evaluate('window.__LOG.slice(-6)')))
        await b.close()
asyncio.run(main())
