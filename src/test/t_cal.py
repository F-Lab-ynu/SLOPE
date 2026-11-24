# カレンダーの購読：マイページを開くと合い言葉ができ、iPhone・Google のリンクに入る。予定のカードに「カレンダーに追加」
import asyncio, json, sys, os
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 't_member.py')).read()
exec(src[:src.index('async def main():')])
import datetime
TODAY_ = datetime.date.today().isoformat()
SEED['items'].append({'id': 'c9', 'kind': 'cal', 'data': {'title': '定例会', 'date': TODAY_, 'time': '18:30', 'state': 'pub'}, 'state': 'ok', 'pos': 0, 'author': A, 'created_at': '2026-11-01T00:00:00Z'})
SEED['cal_tokens'] = []
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        errs = []
        pg = await page_as(b, B, {'width': 390, 'height': 844}, errs)
        await pg.evaluate("document.querySelector('#stage button[aria-label=\"マイページ\"]').click()"); await pg.wait_for_timeout(800)
        toks = await db(pg, 'cal_tokens'); print('token rows:', len(toks))
        hrefs = await pg.evaluate("Array.from(document.querySelectorAll('#stage a')).map(a=>a.getAttribute('href')).filter(h=>/webcal|google/.test(h))")
        print('links:', [h[:70] for h in hrefs])
        el = pg.locator('#stage h2:has-text("設定")').last; await el.scroll_into_view_if_needed(); await pg.screenshot(path='/tmp/calsub.png'); print('push row:', await pg.evaluate("(document.querySelector('#stage button[role=switch]')||{}).innerText"))
        await pg.evaluate("document.querySelectorAll('#stage nav button, .tabbar button, button').forEach(b=>{if(b.textContent.trim()==='予定')b.click()})"); await pg.wait_for_timeout(500)
        print('ics buttons:', await pg.locator('#stage button[aria-label="カレンダーに追加"]:visible').count())
        await pg.screenshot(path='/tmp/calday.png')
        print('errors:', errs)
        await b.close()
asyncio.run(main())
