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
rep("""    ks.push(kpi('未対応', rep + off, '通報 ' + rep + '・情報提供 ' + off, false, rep ? 'board' : 'notices'));""",
    """    ks.push(kpi('承認待ち', (S.pending || []).length, 'メンバー画面で承認', false, 'perms'));""")
rep('<div class="msw on" data-to="./"', '<div class="msw on" data-to="./"', 0) if False else None
i = s.rindex("\nrender();")
s = s[:i] + "\n" + js + "\nboot();" + s[i + len("\nrender();"):]
rep("</style>", css + "</style>")
rep("<head>", "<head>\n<script src=\"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js\"></script>")
open('admin.html', 'w').write(s)
print('built admin.html', len(s))
