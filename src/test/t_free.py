# 掲示板フリー：#タグで絞り込み、返信はその場で開く
import asyncio, os
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 't_member.py')).read()
exec(src[:src.index('async def main():')])
for i, t in enumerate(['「起業の科学」読んだ #本', '#本 ゼロ・トゥ・ワン良かった', '期末つらい', '#就活 インターンどこ行く？']):
    SEED['items'].append({'id': 'o%d' % i, 'kind': 'other', 'data': {'text': t}, 'state': 'ok', 'pos': 0, 'author': A, 'created_at': '2026-11-2%dT00:00:00Z' % i})
SEED['items'].append({'id': 'o9', 'kind': 'other', 'data': {'text': '古い投稿', 'tag': '雑談'}, 'state': 'ok', 'pos': 0, 'author': A, 'created_at': '2026-11-01T00:00:00Z'})
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']); errs = []
        pg = await page_as(b, B, {'width': 390, 'height': 844}, errs)
        print('early errs', errs)
        await pg.click('#stage nav button:has-text("掲示板")'); await pg.wait_for_timeout(300)
        await pg.click('#stage button:has-text("フリー")'); await pg.wait_for_timeout(300)
        print('tags:', await pg.evaluate("Array.from(document.querySelectorAll('.frtags button')).map(b=>b.textContent)"), '| posts:', await pg.locator('.frp').count())
        await pg.click('.frtags button:has-text("#本")'); await pg.wait_for_timeout(300); print('filtered:', await pg.locator('.frp').count())
        await pg.fill('#otText', '新しい本の話'); await pg.click('.frnew button[aria-label="投稿"]'); await pg.wait_for_timeout(500)
        print('posted with tag:', [i['data']['text'] for i in await db(pg, 'items') if i['kind'] == 'other'][:1])
        await pg.locator('.frp button[aria-label="返信"]').first.click(); await pg.wait_for_timeout(300)
        await pg.fill('#otReply', 'いいね'); await pg.click('.frnew.sm button'); await pg.wait_for_timeout(500)
        print('reply shown:', await pg.locator('.frr').count())
        await pg.screenshot(path='/tmp/free.png')
        print('errors:', errs); await b.close()
asyncio.run(main())
