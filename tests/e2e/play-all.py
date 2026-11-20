import os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
FIX=os.environ.get('E2E_FIXTURES','/tmp/bizsim-e2e')
SHOTS=os.environ.get('E2E_SHOTS','/tmp/bizsim-shots')
os.makedirs(SHOTS, exist_ok=True)
import asyncio, sys, json
from playwright.async_api import async_playwright
B='http://localhost:8798'
IDS=sys.argv[1:]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])
        errs=[]; bad=[]
        ctx = await b.new_context(viewport={'width':1280,'height':900}, color_scheme='dark')
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console:'+m.text) if m.type=='error' else None)
        if IDS==['ALL']:
            await pg.goto(B+'/cases'); await pg.wait_for_timeout(1000)
            ids = await pg.evaluate("""fetch('/').then(()=>null)""")
            import subprocess
            IDS2=json.loads(subprocess.check_output(['node','--input-type=module','-e',"const {CASES}=await import('"+ROOT+"/shared/cases/index.js');console.log(JSON.stringify(CASES.map(c=>c.id)))"]))
        else: IDS2=IDS
        for cid in IDS2:
            try:
                await pg.goto(B+'/cases/'+cid); await pg.wait_for_selector('nav[aria-label="Step navigation"] .btn-primary', timeout=8000)
                for _ in range(3):
                    await pg.locator('nav[aria-label="Step navigation"] .btn-primary').click(); await pg.wait_for_timeout(40)
                n=0; outcomes=0
                while n<12:
                    opts=pg.locator('.option:not([data-locked=true])')
                    if await opts.count()==0: break
                    await opts.nth(n%3).click(); await pg.get_by_role('button', name='Submit decision').click(); n+=1
                    await pg.wait_for_timeout(30)
                    if await pg.locator('.episode-outcome').count(): outcomes+=1
                    done=False
                    for name in ['Next decision','Episode II','Episode III','Episode IV','See the season outcome']:
                        btn=pg.get_by_role('button', name=name, exact=True)
                        if await btn.count():
                            await btn.click(); await pg.wait_for_timeout(30)
                            if name=='See the season outcome': done=True
                            break
                    if done: break
                await pg.get_by_role('button', name='Insight', exact=True).first.click(); await pg.wait_for_timeout(80)
                txt=await pg.inner_text('main')
                ok = n==8 and outcomes==4 and 'episode insights' in txt.lower() and 'Something went wrong' not in txt
                if not ok: bad.append((cid,n,outcomes))
                print(cid, n, outcomes, flush=True)
            except Exception as e:
                bad.append((cid,'ERR',str(e)[:80]))
        print('played', len(IDS2), 'bad', bad[:20])
        print(sorted(set(errs))[:10] or 'no errors')
        await b.close()
asyncio.run(main())
