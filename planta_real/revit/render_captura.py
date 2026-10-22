import sys, subprocess, time
from playwright.sync_api import sync_playwright
srv = subprocess.Popen(['python3', '-m', 'http.server', '8765', '-d', '/tmp/render'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = b.new_page(viewport={'width': 1400, 'height': 1000})
        msgs = []
        pg.on('console', lambda m: msgs.append(m.text))
        for a in sys.argv[1:]:
            nombre, qs = a.split('|', 1)
            pg.goto('http://localhost:8765/index.html?' + qs)
            pg.wait_for_function("document.title=='listo'", timeout=120000)
            pg.screenshot(path='/tmp/' + nombre + '.png')
        if msgs: print('\n'.join(msgs[:5]))
        b.close()
finally:
    srv.terminate()
