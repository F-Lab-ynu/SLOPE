# お問い合わせ：マイページから送ると自分の「送ったもの」に出る
import asyncio, os
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 't_member.py')).read()
exec(src[:src.index('async def main():')])
SEED['inquiries'] = []
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']); errs = []
        pg = await page_as(b, B, {'width': 390, 'height': 844}, errs)
        await pg.evaluate("document.querySelector('#stage button[aria-label=\"マイページ\"]').click()"); await pg.wait_for_timeout(500)
        await pg.click('#stage button:has-text("お問い合わせ・要望")'); await pg.wait_for_timeout(400)
        await pg.click('.iqkinds button:has-text("不具合")'); await pg.fill('#iqText', 'カレンダーが1日ずれます'); await pg.click('.iqsend'); await pg.wait_for_timeout(700)
        rows = await db(pg, 'inquiries'); print('saved:', [(r.get('kind'), r.get('body')) for r in rows])
        print('mine shown:', await pg.locator('.iqm').count(), '| textarea cleared:', await pg.input_value('#iqText') == '')
        await pg.screenshot(path='/tmp/iqm.png')
        print('errors:', errs); await b.close()
asyncio.run(main())
