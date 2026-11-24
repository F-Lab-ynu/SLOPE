# テーマ：マイページの「テーマ」から組み合わせを選ぶと当たり、開き直しても残る
import asyncio, os
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 't_member.py')).read()
exec(src[:src.index('async def main():')])
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']); errs = []
        pg = await page_as(b, B, {'width': 390, 'height': 844}, errs)
        await pg.evaluate("document.querySelector('#stage button[aria-label=\"マイページ\"]').click()"); await pg.wait_for_timeout(500)
        print('mode toggle gone:', await pg.locator('[data-mode-toggle]').count() == 0)
        await pg.click('#stage [data-theme-open]'); await pg.wait_for_timeout(300)
        print('tiles:', await pg.locator('.thc').count()); await pg.screenshot(path='/tmp/th1.png')
        await pg.click('.thc[data-th="#E8F0F8,#14202E,#2F6FB0"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/th2.png')
        print('light:', await pg.evaluate("document.documentElement.classList.contains('light')"), await pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--bg')"))
        await pg.reload(); await pg.wait_for_timeout(1200)
        print('kept:', await pg.evaluate("localStorage.getItem('slope-theme')"), await pg.evaluate("document.documentElement.classList.contains('light')"))
        await pg.screenshot(path='/tmp/th3.png')
        print('errors:', errs); await b.close()
asyncio.run(main())
