# 運営画面（本番）を組み立てる：admin モック + prod.js + prod.css
s = open('src/mock/admin-mock.html').read()
js = open('src/prod.js').read(); css = open('src/prod.css').read()
logo = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4.5c5-1.4 13-1.4 18 0-.6 1.3-1.5 2.2-2.6 2.6-4.3-.7-8.5-.7-12.8 0C4.5 6.7 3.6 5.8 3 4.5z" fill="#111827"/><path d="M7.3 9.2l7.2-.3-.6 1.9 3.6-.1-2.4 3.4-3.3.1L9.3 21z" fill="#111827"/></svg>'
js = js.replace("ic('logo')", "'" + logo + "'")
def rep(a, b, c=1):
    global s
    assert s.count(a) == c, (s.count(a), a[:70]); s = s.replace(a, b)
rep("var KEY = 'slope-admin-v10';", "var KEY = 'slope-prod-v1';")
rep("""try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
if (!S || !S.projects) S = sample();""", """S = { view: 'dash', me: null, projects: [], members: [], pending: [], notifs: [], tracks: [], notices: [], posts: [], offers: [], manualOrder: true };""")
rep("""    var tn = todo.reduce""", """    if (isAdmin() && (S.pending || []).length) todo.unshift(['perms', '承認待ち', S.pending.length]);
    var tn = todo.reduce""")
rep('<div class="msw on" data-to="./"', '<div class="msw on" data-to="./"', 0) if False else None
i = s.rindex("\nrender();")
s = s[:i] + "\n" + js + "\nboot();" + s[i + len("\nrender();"):]
rep("</style>", css + "</style>")
rep("<head>", "<head>\n<script src=\"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js\"></script>")
SNIP = "\n<script>\n// 新しい版が出ていたら、キャッシュを避けて読み直す（GitHub Pages は最大10分キャッシュするため）\n(function () {\n  var VER = '__VER__', FILE = '__FILE__';\n  function check() {\n    fetch(FILE + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (v) {\n      v = (v || '').trim(); if (!v || v === VER) return;\n      var q = new URLSearchParams(location.search); if (q.get('v') === v) return;\n      location.replace(location.pathname + '?v=' + v + location.hash);\n    }).catch(function () {});\n  }\n  check(); document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });\n})();\n</script>\n"

import hashlib
def stamp(s, page, verfile):
    v = hashlib.sha1(s.encode()).hexdigest()[:10]
    s = s.replace('<head>', '<head>' + SNIP.replace('__VER__', v).replace('__FILE__', verfile), 1)
    open(verfile, 'w').write(v + '\n')
    return s

s = stamp(s, 'admin.html', 'admin.ver')
open('admin.html', 'w').write(s)
print('built admin.html', len(s))
