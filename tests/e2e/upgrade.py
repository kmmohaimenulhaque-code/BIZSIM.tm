import os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
FIX=os.environ.get('E2E_FIXTURES','/tmp/bizsim-e2e')
SHOTS=os.environ.get('E2E_SHOTS','/tmp/bizsim-shots')
os.makedirs(SHOTS, exist_ok=True)
import asyncio, subprocess, time, os, shutil, glob
from playwright.async_api import async_playwright
OLD=os.environ['OLD_APP']  # path to an unpacked 1.5 'bizsim' executable
NEW=ROOT+'/release/linux-unpacked/bizsim'
home='/tmp/mighome'; shutil.rmtree(home, ignore_errors=True); os.makedirs(home)
env=dict(os.environ, HOME=home, XDG_CONFIG_HOME=home+'/.config')
async def run(app, fn):
    p = subprocess.Popen(['xvfb-run','-a','-s','-screen 0 1280x900x24',app,'--no-sandbox','--remote-debugging-port=9342'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=env)
    time.sleep(15)
    async with async_playwright() as pw:
        b = await pw.chromium.connect_over_cdp('http://localhost:9342')
        pg = [x for c in b.contexts for x in c.pages if 'devtools' not in x.url][0]
        r = await fn(pg)
        await b.close()
    p.terminate(); time.sleep(1); subprocess.run(['pkill','-f',app]); time.sleep(3)
    return r
async def old(pg):
    base = pg.url.split('#')[0].rstrip('/')
    await pg.goto(base+'/cases/season-c001'); await pg.wait_for_timeout(1500)
    for _ in range(3):
        await pg.locator('nav[aria-label="Step navigation"] .btn-primary').click(); await pg.wait_for_timeout(100)
    await pg.locator('.option').first.click(); await pg.get_by_role('button', name='Submit decision').click(); await pg.wait_for_timeout(500)
    await pg.wait_for_timeout(12000)
    return await pg.evaluate("[navigator.userAgent.match(/Electron\\/([\\d.]+)/)[1], JSON.parse(localStorage.getItem('bizsim.state.v1')).runs.length, JSON.parse(localStorage.getItem('bizsim.state.v1')).runs[0].choices.length]")
async def new(pg):
    await pg.wait_for_timeout(1000)
    return await pg.evaluate("[navigator.userAgent.match(/Electron\\/([\\d.]+)/)[1], (JSON.parse(localStorage.getItem('bizsim.state.v1')||'{}').runs||[]).length, ((JSON.parse(localStorage.getItem('bizsim.state.v1')||'{}').runs||[])[0]||{choices:[]}).choices.length]")
async def main():
    a = await run(OLD, old); print('1.5 wrote', a)
    b = await run(NEW, new); print('1.6 read ', b)
    print('PASS progress survives 1.5 -> 1.6 upgrade' if b[1]==a[1] and b[2]==a[2] and a[1]>0 else 'FAIL migration')
asyncio.run(main())
