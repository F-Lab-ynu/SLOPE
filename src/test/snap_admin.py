# 運営画面（サンプルデータ）を決まった手順で触り、各段階のHTMLを保存する。直す前と後で比べる
# 使い方：python3 src/test/snap_admin.py <保存先>   （SHOT=1 で画面の画像も、STEPS=40 で1画面あたりの手数）
import asyncio, http.server, threading, functools, sys, os, hashlib, re, json
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[-1]; PAGE = 'src/mock/_admin.html'
sys.path.insert(0, ROOT + '/src'); from assemble_admin import assemble
open(ROOT + '/' + PAGE, 'w').write(assemble())
def norm(h):  # style の書き方の揺れ（空白・末尾の ; ・空の style）をそろえる
    return re.sub(r' style="([^"]*)"', lambda m: (' style="' + re.sub(r'\s+', '', m.group(1)).rstrip(';') + '"') if m.group(1).strip() else '', h)
STEPS = int(os.environ.get('STEPS', '30')); COV = os.environ.get('COV')
os.makedirs(OUT, exist_ok=True)
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT))
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
threading.Thread(target=srv.serve_forever, daemon=True).start(); PORT = srv.server_address[1]
INIT = """(()=>{ document.addEventListener('DOMContentLoaded',()=>{ const st=document.createElement('style'); st.textContent='#toast{display:none!important}*{caret-color:transparent!important;transition:none!important;animation:none!important}'; document.head.appendChild(st); }); let s=12345; Math.random=function(){ s=(s*1103515245+12345)%2147483648; return s/2147483648; };
  window.open=function(){return null}; window.print=function(){}; })();"""
SNAPJS = """(()=>{ const c=document.body.cloneNode(true); c.querySelectorAll('script,iframe,#toast').forEach(e=>e.remove());
  let h=c.innerHTML; return h.replace(/\\s+/g,' ').replace(/data-gcm="\\d+"/g,'data-gcm'); })()"""
CAND = """(()=>{ const sel='button,[data-act],[role=button],[role=tab],.fcard,.gr[data-row],input[type=checkbox],[tabindex="0"],summary,.p2row,.trow';
  const out=[]; document.querySelectorAll(sel).forEach(e=>{ if(e.closest('.msw')||e.closest('#toast')||e.matches('[data-act=go],[data-act=switch]')||/ログアウト|logout/i.test(e.textContent)) return;
   const r=e.getBoundingClientRect(); if(r.width<2||r.height<2||r.bottom<0||r.top>innerHeight) return; out.push(e); });
  window.__C=out; return out.length; })()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []; n = 0; covs = []
        for vp in [dict(width=1440, height=900), dict(width=390, height=844)]:
            ctx = await b.new_context(viewport=vp); await ctx.add_init_script(INIT)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg.clock.set_fixed_time('2026-11-25T10:00:00+09:00')
            await pg.route('**/*', lambda r: r.continue_() if '127.0.0.1' in r.request.url else r.abort())
            if COV: cdp = await ctx.new_cdp_session(pg); await cdp.send('Profiler.enable'); await cdp.send('Profiler.startPreciseCoverage', {'callCount': True, 'detailed': False})
            await pg.goto(f'http://127.0.0.1:{PORT}/{PAGE}'); await pg.wait_for_timeout(800)
            seed = 7
            for view in ['dash', 'projects', 'tracks', 'notices', 'board', 'perms']:
                for k in range(STEPS):
                    if k % 10 == 0:
                        await pg.keyboard.press('Escape')
                        ok = await pg.evaluate(f"(()=>{{const e=document.querySelector('[data-act=go][data-view={view}]'); if(!e) return false; e.click(); return true}})()")
                        if not ok:
                            await pg.goto(f'http://127.0.0.1:{PORT}/{PAGE}'); await pg.wait_for_timeout(800)
                            await pg.evaluate(f"(()=>{{const e=document.querySelector('[data-act=go][data-view={view}]'); if(e) e.click()}})()")
                        await pg.wait_for_timeout(250)
                    m = await pg.evaluate(CAND)
                    seed = (seed * 48271) % 2147483647
                    if m:
                        i = seed % m; act = 'ctx' if seed % 7 == 0 else 'click'
                        await pg.evaluate(f"""(()=>{{ const e=window.__C[{i}]; const r=e.getBoundingClientRect(); const o={{bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2,button:{2 if act=='ctx' else 0}}};
                          if('{act}'==='ctx') e.dispatchEvent(new MouseEvent('contextmenu',o)); else {{ e.dispatchEvent(new PointerEvent('pointerdown',o)); e.dispatchEvent(new MouseEvent('mousedown',o)); e.dispatchEvent(new PointerEvent('pointerup',o)); e.dispatchEvent(new MouseEvent('mouseup',o)); e.click(); }} }})()""")
                        await pg.wait_for_timeout(120)
                    h = await pg.evaluate(SNAPJS); n += 1
                    open(f'{OUT}/{n:04d}_{vp["width"]}_{view}.html', 'w').write(norm(h))
                    if os.environ.get('SHOT') and n % 3 == 0: await pg.screenshot(path=f'{OUT}/{n:04d}.png')
            DIR = {'dash': ['.utabs button', '.nr2', '.mr'], 'projects': ['.ftn', '.fcard', '[data-act=fmode]', '.gr[data-row]'], 'tracks': ['.p2r'],
                   'notices': ['.utabs button', '.evr', '.evr [data-act]'], 'board': ['.utabs button', '.acts button', 'tr'], 'perms': ['.mname', '[data-m]']}
            for view, sels in DIR.items():
                for sel in sels:
                    for idx in range(14):
                        await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape')
                        if not await pg.evaluate(f"(()=>{{const e=document.querySelector('[data-act=go][data-view={view}]'); if(!e) return false; e.click(); return true}})()"):
                            await pg.goto(f'http://127.0.0.1:{PORT}/{PAGE}'); await pg.wait_for_timeout(600); continue
                        await pg.wait_for_timeout(150)
                        for act in ('click', 'ctx'):
                            got = await pg.evaluate(f"""(()=>{{ const L=[...document.querySelectorAll({json.dumps(sel)})].filter(e=>e.getBoundingClientRect().width>1); const e=L[{idx}]; if(!e) return false; e.scrollIntoView({{block:'center'}}); const r=e.getBoundingClientRect();
                              const o={{bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2,button:{{'ctx':2,'click':0}}['{{act}}'.replace('{{act}}','{act}')]}};
                              if('{act}'==='ctx') e.dispatchEvent(new MouseEvent('contextmenu',o)); else e.click(); return true }})()""")
                            if not got: break
                            await pg.wait_for_timeout(120); h = await pg.evaluate(SNAPJS); n += 1
                            open(f'{OUT}/{n:04d}_{vp["width"]}_D{view}.html', 'w').write(norm(h))
                            if os.environ.get('SHOT') and n % 3 == 0: await pg.screenshot(path=f'{OUT}/{n:04d}.png')
                            if act == 'click':
                                await pg.keyboard.press('Escape'); await pg.wait_for_timeout(60)
                        if not got: break
            if COV:
                r = await cdp.send('Profiler.takePreciseCoverage'); covs.append(r['result'])
            await ctx.close()
        if COV: json.dump(covs, open(COV, 'w'))
        open(f'{OUT}/errors.txt', 'w').write('\n'.join(errs)); print('snaps', n, 'errors', len(errs))
        await b.close()
asyncio.run(main())
