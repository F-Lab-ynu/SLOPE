# 運営画面（サンプルデータ）：日付のカレンダー・出席・外部告知の編集
import asyncio, http.server, threading, functools, sys, os, re
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT + '/src'); from assemble_admin import assemble
open(ROOT + '/src/mock/_admin.html', 'w').write(assemble())
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)); http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
threading.Thread(target=srv.serve_forever, daemon=True).start(); P = srv.server_address[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        for w, touch in [(1440, False), (390, True)]:
            ctx = await b.new_context(viewport=dict(width=w, height=900), has_touch=touch)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.route(re.compile(r'^(?!http://127\.0\.0\.1).*'), lambda r: r.abort())
            await pg.goto(f'http://127.0.0.1:{P}/src/mock/_admin.html'); await pg.wait_for_timeout(600)
            await pg.evaluate("document.querySelector('[data-act=go][data-view=tracks]').click()"); await pg.wait_for_timeout(300)
            await pg.evaluate("[...document.querySelectorAll('.p2r')].find(r=>/MIRA/.test(r.textContent)).click()"); await pg.wait_for_timeout(300)
            # 日付
            if touch: await pg.tap('[data-ce=date]')
            else: await pg.click('[data-ce=date]')
            await pg.wait_for_timeout(200)
            shown = await pg.locator('.dpk').count()
            await pg.click('.dpk [data-dpd="2026-12-10"]'); await pg.wait_for_timeout(400)
            v = await pg.input_value('[data-ce=date]')
            print(w, 'picker:', shown == 1, '| value:', v, '| closed:', await pg.locator('.dpk').count() == 0)
            # 出席
            await pg.click('[data-attopen]'); await pg.wait_for_timeout(300)
            await pg.locator('[data-attm]').first.check(); await pg.wait_for_timeout(300)
            await pg.mouse.click(5, 5); await pg.wait_for_timeout(300)
            print(w, 'attend chips:', await pg.locator('.p2box .attc').count(), '| button:', (await pg.locator('[data-attopen]').text_content()).strip())
            # 設定のスイッチ：告知に出す・鍵
            await pg.evaluate("document.querySelector('[data-act=go][data-view=tracks]').click()"); await pg.wait_for_timeout(300)
            await pg.evaluate("[...document.querySelectorAll('.p2r')].find(r=>/MIRA/.test(r.textContent)).click()"); await pg.wait_for_timeout(300)
            await pg.click('.opt:has([data-p2f=lock])'); await pg.wait_for_timeout(300)
            lock = await pg.evaluate("[...document.querySelectorAll('.p2r')].find(r=>/MIRA/.test(r.textContent)).querySelector('.p2l').classList.contains('on')")
            await pg.click('.opt:has([data-evn])'); await pg.wait_for_timeout(400)
            inN = await pg.locator('[data-evn]').is_checked()
            print(w, 'lock on:', lock, '| notice off:', not inN, '| public row hidden:', await pg.locator('[data-ce=state]').count() == 0)
            await pg.click('.opt:has([data-evn])'); await pg.wait_for_timeout(400)
            # ⋯ でメニュー
            if w < 600: await pg.click('.p2back'); await pg.wait_for_timeout(300)
            await pg.click('.p2r >> nth=2 >> .rmore'); await pg.wait_for_timeout(300)
            print(w, 'menu from ⋯:', await pg.locator('#cm').is_visible()); await pg.keyboard.press('Escape')
            # 告知のダイアログ：学ぶに出すを切って保存
            await pg.evaluate("document.querySelector('[data-act=go][data-view=notices]').click()"); await pg.wait_for_timeout(300)
            await pg.click('.utabs button[data-v=ev]'); await pg.wait_for_timeout(300)
            await pg.evaluate("[...document.querySelectorAll('.evr[data-calid]')].find(r=>/MIRA/.test(r.textContent)).querySelector('[data-act=calItem]').click()"); await pg.wait_for_timeout(300)
            await pg.click('.opt:has(#cG)'); await pg.click('[data-act=calSave]'); await pg.wait_for_timeout(400)
            print(w, 'learn tag gone:', await pg.evaluate("![...document.querySelectorAll('.evr[data-calid]')].find(r=>/MIRA/.test(r.textContent)).querySelector('.evtag')"))
            # 外部告知：ペンで編集ダイアログ
            await pg.evaluate("document.querySelector('[data-act=go][data-view=notices]').click()"); await pg.wait_for_timeout(300)
            await pg.click('.utabs button[data-v=list]'); await pg.wait_for_timeout(300)
            await pg.click('.nvl [data-act=nEdit]'); await pg.wait_for_timeout(300)
            print(w, 'notice dialog:', await pg.locator('#modal .dlg').count() == 1, '| fab hidden:', not await pg.locator('.efabw').is_visible() if await pg.locator('.efabw').count() else True)
            await ctx.close()
        print('errors:', errs); await b.close()
asyncio.run(main())
