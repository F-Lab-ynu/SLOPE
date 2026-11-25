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
            if touch: print(w, 'touch uses native only:', shown == 0)
            else:
                await pg.click('.dpk [data-dpd="2026-12-10"]'); await pg.wait_for_timeout(400)
                v = await pg.input_value('[data-ce=date]')
                print(w, 'picker:', shown == 1, '| value:', v, '| closed:', await pg.locator('.dpk').count() == 0)
                await pg.click('[data-ce=time]'); await pg.wait_for_timeout(200)
                await pg.click('.tpk [data-tph="19"]'); await pg.click('.tpk [data-tpm="30"]'); await pg.wait_for_timeout(300)
                print(w, 'time:', await pg.input_value('[data-ce=time]'), '| closed:', await pg.locator('.tpk').count() == 0)
            # 出席
            await pg.click('[data-attopen]'); await pg.wait_for_timeout(300)
            await pg.locator('[data-attm]').first.check(); await pg.wait_for_timeout(300)
            await pg.mouse.click(5, 5); await pg.wait_for_timeout(300)
            print(w, 'attend chips:', await pg.locator('.p2box .attc').count(), '| button:', (await pg.locator('[data-attopen]').text_content()).strip())
            # 設定のスイッチ：順番に進める／公開は確認してから
            await pg.evaluate("document.querySelector('[data-act=go][data-view=tracks]').click()"); await pg.wait_for_timeout(300)
            await pg.evaluate("[...document.querySelectorAll('.p2r')].find(r=>/MIRA/.test(r.textContent)).click()"); await pg.wait_for_timeout(300)
            await pg.click('.opt:has([data-p2f=lock])'); await pg.wait_for_timeout(300)
            lock = await pg.evaluate("[...document.querySelectorAll('.p2r')].find(r=>/MIRA/.test(r.textContent)).querySelector('.p2l').classList.contains('on')")
            await pg.click('.p2ed [data-act=evPub]'); await pg.wait_for_timeout(300)
            dlg = await pg.locator('#modal .dlg').count(); await pg.click('[data-act=evPubDo]'); await pg.wait_for_timeout(400)
            st = (await pg.locator('.p2ed .p2pub').first.text_content()).strip()
            print(w, 'lock on:', lock, '| publish asks first:', dlg == 1, '| status:', st, '| names:', await pg.locator('.opt b').all_text_contents())
            # 学ぶにイベントを置く：選ぶ
            if w < 600: await pg.click('.p2back'); await pg.wait_for_timeout(300)
            await pg.evaluate("document.querySelector('.p2tb [data-p2a=ne]').click()"); await pg.wait_for_timeout(300)
            names = await pg.locator('.evpk b').all_text_contents()
            await pg.evaluate("[...document.querySelectorAll('.evpk')].find(b=>/演習会/.test(b.textContent)).click()"); await pg.wait_for_timeout(400)
            print(w, 'picker:', names[:3], '| placed:', await pg.evaluate("[...document.querySelectorAll('.p2r')].some(r=>/演習会/.test(r.textContent))"))
            # 業務のフォルダーをイベントに
            await pg.evaluate("document.querySelector('[data-act=go][data-view=projects]').click()"); await pg.wait_for_timeout(300)
            await pg.evaluate("[...document.querySelectorAll('.fcard.isfc')].find(c=>/教育コンテンツ/.test(c.textContent)).dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:300,clientY:300}))"); await pg.wait_for_timeout(300)
            await pg.click('#cm [data-cm=evt]'); await pg.wait_for_timeout(300)
            await pg.click('.evpk.new'); await pg.wait_for_timeout(400)
            await pg.evaluate("document.querySelector('[data-act=go][data-view=notices]').click()"); await pg.wait_for_timeout(300)
            await pg.click('.utabs button[data-v=ev]'); await pg.wait_for_timeout(300)
            print(w, 'folder event in notices:', await pg.evaluate("[...document.querySelectorAll('.evr[data-calid]')].some(r=>/教育コンテンツ/.test(r.textContent) && r.querySelector('.evtag.wkt'))"))
            await pg.evaluate("document.querySelector('[data-act=go][data-view=tracks]').click()"); await pg.wait_for_timeout(300)
            # ⋯ でメニュー
            if w < 600: await pg.click('.p2back'); await pg.wait_for_timeout(300)
            await pg.click('.p2r >> nth=2 >> .rmore'); await pg.wait_for_timeout(300)
            print(w, 'menu from ⋯:', await pg.locator('#cm').is_visible()); await pg.keyboard.press('Escape')
            # 告知のダイアログ：学ぶに出すを切って保存
            await pg.evaluate("document.querySelector('[data-act=go][data-view=notices]').click()"); await pg.wait_for_timeout(300)
            await pg.click('.utabs button[data-v=ev]'); await pg.wait_for_timeout(300)
            await pg.evaluate("[...document.querySelectorAll('.evr[data-calid]')].find(r=>r.querySelector('.evn b').firstChild.textContent==='MIRA').querySelector('[data-act=calItem]').click()"); await pg.wait_for_timeout(300)
            await pg.click('.opt:has(#cG)'); await pg.click('[data-act=calSave]'); await pg.wait_for_timeout(400)
            print(w, 'learn tag gone:', await pg.evaluate("![...document.querySelectorAll('.evr[data-calid]')].find(r=>r.querySelector('.evn b').firstChild.textContent==='MIRA').querySelector('.evtag:not(.wkt)')"))
            # 外部告知：ペンで編集ダイアログ
            await pg.evaluate("document.querySelector('[data-act=go][data-view=notices]').click()"); await pg.wait_for_timeout(300)
            await pg.click('.utabs button[data-v=list]'); await pg.wait_for_timeout(300)
            await pg.click('.nvl [data-act=nEdit]'); await pg.wait_for_timeout(300)
            print(w, 'notice dialog:', await pg.locator('#modal .dlg').count() == 1, '| fab hidden:', not await pg.locator('.efabw').is_visible() if await pg.locator('.efabw').count() else True)
            # 計画中の「公開する」：入力欄に打てる
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
            await pg.click('.utabs button[data-v=ev]'); await pg.wait_for_timeout(300)
            await pg.click('.ev-plan [data-act=evPub]'); await pg.wait_for_timeout(300)
            await pg.click('[data-evf=place]'); await pg.keyboard.type('X棟'); await pg.wait_for_timeout(200)
            print(w, 'publish form types:', (await pg.input_value('[data-evf=place]')).endswith('X棟'))
            await ctx.close()
        print('errors:', errs); await b.close()
asyncio.run(main())
