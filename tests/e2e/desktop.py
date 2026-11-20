import os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
FIX=os.environ.get('E2E_FIXTURES','/tmp/bizsim-e2e')
SHOTS=os.environ.get('E2E_SHOTS','/tmp/bizsim-shots')
os.makedirs(SHOTS, exist_ok=True)
import asyncio, subprocess, time, json, os, shutil
from playwright.async_api import async_playwright
APP=ROOT+'/release/linux-unpacked/bizsim'
R=[]
def check(n, ok, info=''):
    R.append(ok); print(('PASS ' if ok else 'FAIL ')+n, info, flush=True)
async def main():
    home='/tmp/deskhome'; shutil.rmtree(home, ignore_errors=True); os.makedirs(home)
    env=dict(os.environ, HOME=home, XDG_CONFIG_HOME=home+'/.config')
    p = subprocess.Popen(['xvfb-run','-a','-s','-screen 0 1440x1000x24',APP,'--no-sandbox','--remote-debugging-port=9341',FIX+'/ai.bizsim'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=env)
    time.sleep(16)
    async with async_playwright() as pw:
        b = await pw.chromium.connect_over_cdp('http://localhost:9341')
        pg = [x for c in b.contexts for x in c.pages if 'devtools' not in x.url][0]
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.wait_for_timeout(1500)
        ver = await pg.evaluate("process?.versions?.electron || navigator.userAgent.match(/Electron\\/([\\d.]+)/)?.[1]") if False else await pg.evaluate("navigator.userAgent.match(/Electron\\/([\\d.]+)/)?.[1]")
        check('runs on Electron 45', ver and ver.startswith('45'), ver)
        check('no Node in the page', await pg.evaluate("typeof require==='undefined' && typeof process==='undefined'"))
        t = (await pg.inner_text('body')).lower()
        check('.bizsim opened from the command line shows the import preview', 'import a season' in t and 'file intact' in t)
        await pg.screenshot(path=SHOTS+'/30_desktop_open_file.png')
        await pg.get_by_role('button', name='Import season').click(); await pg.wait_for_timeout(800)
        check('imported in the desktop app', 'gen-testco-e2e1' in pg.url, pg.url)
        base = pg.url.split('/cases')[0]
        await pg.goto(base+'/'); await pg.wait_for_timeout(1500)
        w = await pg.evaluate("document.querySelector('.hero-image img')?.naturalWidth||0")
        check('desktop homepage background image', w>0)
        await pg.screenshot(path=SHOTS+'/31_desktop_home.png')
        st = await pg.evaluate("fetch('/api/share').then(r=>r.status)")
        check('desktop page may manage phone access', st==200)
        check('notification permission granted in the app', await pg.evaluate("Notification.requestPermission()")=='granted')
        check('no page errors', not errs, str(errs[:2]))
        await b.close()
    p.terminate(); subprocess.run(['pkill','-f','linux-unpacked/bizsim']); time.sleep(2)
    print('RESULT', sum(R), 'passed', len(R)-sum(R), 'failed')
asyncio.run(main())
