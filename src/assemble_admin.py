# 運営画面の元（src/admin/）を1つのHTMLに組み立てる
import os, glob
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'admin')
def assemble():
    page = open(D + '/page.html').read()
    css = open(D + '/admin.css').read().rstrip('\n')
    js = ''.join(open(f).read() for f in sorted(glob.glob(D + '/js/*.js'))).rstrip('\n')
    assert page.count('/*@@CSS@@*/') == 1 and page.count('//@@JS@@') == 1
    return page.replace('/*@@CSS@@*/', css).replace('//@@JS@@', js)
if __name__ == '__main__':
    import sys; open(sys.argv[1], 'w').write(assemble())
