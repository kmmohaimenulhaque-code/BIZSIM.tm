import os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
FIX=os.environ.get('E2E_FIXTURES','/tmp/bizsim-e2e')
SHOTS=os.environ.get('E2E_SHOTS','/tmp/bizsim-shots')
os.makedirs(SHOTS, exist_ok=True)
import asyncio, json, os, glob
from playwright.async_api import async_playwright
B='http://localhost:8798'
R=[]
def check(name, ok, info=''):
    R.append((name, bool(ok), info)); print(('PASS ' if ok else 'FAIL ')+name, info, flush=True)

async def play_all(pg, from_decisions=False):
    for _ in range(0 if from_decisions else 3):
        await pg.locator('nav[aria-label="Step navigation"] .btn-primary').click(); await pg.wait_for_timeout(60)
    n=0
    while n<16:
        opts=pg.locator('.option:not([data-locked=true])')
        if await opts.count()==0: break
        await opts.nth(n%2).click(); await pg.get_by_role('button', name='Submit decision').click(); n+=1
        await pg.wait_for_timeout(40)
        done=False
        for name in ['Next decision','Episode II','Episode III','Episode IV','See the season outcome']:
            btn=pg.get_by_role('button', name=name, exact=True)
            if await btn.count():
                await btn.click(); await pg.wait_for_timeout(40)
                if name=='See the season outcome': done=True
                break
        if done: break
    return n

async def wait_text(pg, sel, needle, timeout=15000):
    t=''
    for _ in range(timeout//250):
        try: t = await pg.inner_text(sel)
        except Exception: t=''
        if needle.lower() in t.lower(): return t
        await pg.wait_for_timeout(250)
    return t

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width':1280,'height':900}, color_scheme='dark', accept_downloads=True)
        await ctx.grant_permissions(['notifications'], origin=B)
        pg = await ctx.new_page()
        errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console:'+m.text) if m.type=='error' and 'Failed to load resource' not in m.text else None)
        pg.on('response', lambda r: errs.append(f'HTTP {r.status} {r.url[:90]}') if r.status>=400 else None)

        # ---- home: hero + case of the day
        await pg.goto(B+'/'); await pg.wait_for_timeout(1500)
        w = await pg.evaluate("(()=>{const i=document.querySelector('.hero-image img');return i? i.naturalWidth:0})()")
        check('hero image loads from the bundle', w>0, f'naturalWidth={w}')
        check('hero is visible', await pg.locator('.hero-image.loaded').count()==1)
        await pg.screenshot(path=SHOTS+'/01_home.png')
        t1 = await pg.locator('.cotd .case-title').inner_text()
        await pg.get_by_role('button', name='Explore another').click(); await pg.wait_for_timeout(200)
        t2 = await pg.locator('.cotd .case-title').inner_text()
        check('case of the day + explore another', t1 and t2 and t1!=t2, f'{t1[:40]} -> {t2[:40]}')
        await pg.reload(); await pg.wait_for_timeout(800)
        t3 = await pg.locator('.cotd .case-title').inner_text()
        check('case of the day stable on reload', t3==t1)

        # ---- classification + evidence
        await pg.goto(B+'/cases/season-c155'); await pg.wait_for_timeout(1200)
        txt = await pg.inner_text('main')
        check('scriptural season labelled', 'scriptural narrative' in txt.lower())
        check('no "source-verified" overclaim', 'source-verified' not in txt.lower())
        await pg.locator('.trust-panel summary').click(); await pg.wait_for_timeout(150)
        tp = await pg.inner_text('.trust-panel')
        check('trust panel explains check', 'does not prove' in tp, tp[:80].replace('\n',' '))
        await pg.screenshot(path=SHOTS+'/02_scriptural.png')
        await pg.goto(B+'/cases/season-c161'); await pg.wait_for_timeout(1000)
        check('oral tradition note on Queen Amina', 'oral tradition' in (await pg.inner_text('main')).lower())
        await pg.goto(B+'/cases/season-c001'); await pg.wait_for_timeout(1000)
        for _ in range(2):
            await pg.locator('nav[aria-label="Step navigation"] .btn-primary').click(); await pg.wait_for_timeout(100)
        tags = await pg.locator('.stat .badge').count()
        check('evidence items carry evidence status', tags>0, f'{tags} tags')
        await pg.screenshot(path=SHOTS+'/03_evidence.png')
        srcmeta = await pg.inner_text('.source-list')
        check('sources labelled by kind', 'Reference work' in srcmeta or 'Primary source' in srcmeta)

        # ---- share dialog: QR + file
        await pg.goto(B+'/cases/season-c001'); await pg.wait_for_timeout(1000)
        await pg.get_by_role('button', name='Share', exact=True).click(); await pg.wait_for_timeout(1500)
        qr = await pg.locator('.dialog .qr-frame img').count()
        meta = await pg.inner_text('.dialog')
        check('share dialog shows QR codes', qr==1 and ' of ' in meta and 'cycling' in meta, meta.split('\n')[-3][:60] if meta else '')
        await pg.screenshot(path=SHOTS+'/04_share.png')
        await pg.select_option('#share-scope', '2'); await pg.wait_for_timeout(800)
        async with pg.expect_download() as d:
            await pg.get_by_role('button', name='Save .bizsim file').click()
        dl = await d.value; path = await dl.path(); data = json.load(open(path))
        check('episode package downloaded', data['format']=='bizsim-package' and data['kind']=='episode' and dl.suggested_filename.endswith('.bizsim'), dl.suggested_filename)
        await pg.keyboard.press('Escape')

        # ---- import: curated, AI new, identical, conflict, tampered
        await pg.goto(B+'/my-cases'); await pg.wait_for_timeout(800)
        async def import_file(f):
            await pg.get_by_role('button', name='Import a season').first.click(); await pg.wait_for_timeout(300)
            await pg.locator('.dialog input[type=file][accept*=bizsim]').set_input_files(f); await pg.wait_for_timeout(500)
            return await pg.inner_text('.dialog')
        t = await import_file(FIX+'/curated.bizsim'); check('curated package recognised as built in', 'already built into BIZSIM' in t)
        await pg.keyboard.press('Escape')
        t = await import_file(FIX+'/tampered.bizsim'); check('tampered package rejected', 'damaged' in t, t.split('\n')[2][:80] if t else '')
        await pg.keyboard.press('Escape')
        t = (await import_file(FIX+'/ai.bizsim')).lower(); check('AI package preview with disclosure', 'ai-written' in t and 'file intact' in t)
        await pg.screenshot(path=SHOTS+'/05_import_preview.png')
        await pg.get_by_role('button', name='Import season').click(); await pg.wait_for_timeout(800)
        check('imported season opens', '/cases/gen-testco-e2e1' in pg.url, pg.url)
        await pg.goto(B+'/my-cases'); await pg.wait_for_timeout(500)
        t = await import_file(FIX+'/ai.bizsim'); check('duplicate import detected', 'already have this exact season' in t)
        await pg.keyboard.press('Escape')
        t = await import_file(FIX+'/ai2.bizsim'); check('changed version asks before overwriting', 'Keep both' in t and 'Replace mine' in t)
        await pg.get_by_role('button', name='Keep both').click(); await pg.wait_for_timeout(600)
        n_my = await pg.evaluate("JSON.parse(localStorage.getItem('bizsim.state.v1')).myCases.length")
        check('keep both stores a copy', n_my==2, f'myCases={n_my}')

        # ---- QR import from pictures, with resume
        await pg.goto(B+'/my-cases'); await pg.wait_for_timeout(500)
        pics = sorted(glob.glob(FIX+'/qr/*.png'))
        await pg.get_by_role('button', name='Import a season').first.click(); await pg.wait_for_timeout(300)
        await pg.locator('.dialog input[type=file][accept="image/*"]').set_input_files(pics[:6])
        t = await wait_text(pg, '.dialog', f'6 / {len(pics)}'); check('partial QR progress shown', f'6 / {len(pics)}' in t, f'{len(pics)} frames')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        await pg.get_by_role('button', name='Import a season').first.click(); await pg.wait_for_timeout(300)
        t = await pg.inner_text('.dialog'); check('QR scan resumes after closing', f'6 / {len(pics)}' in t and 'Continue scanning' in t)
        await pg.locator('.dialog input[type=file][accept="image/*"]').set_input_files(pics[4:])
        t = (await wait_text(pg, '.dialog', 'File intact', 30000)).lower(); check('all QR frames assemble into a preview', 'qr season via codes' in t and 'file intact' in t)
        await pg.get_by_role('button', name='Import season').click(); await pg.wait_for_timeout(600)

        # ---- collections
        await pg.goto(B+'/cases/season-c002'); await pg.wait_for_timeout(800)
        await pg.get_by_role('button', name='Save', exact=True).first.click(); await pg.wait_for_timeout(200)
        await pg.locator('.dialog label:has-text("Finance") input').check(); await pg.wait_for_timeout(100)
        await pg.get_by_role('button', name='Done').click()
        await pg.goto(B+'/collections'); await pg.wait_for_timeout(600)
        t = await pg.inner_text('main'); check('default collections present', all(x in t for x in ['Startup Strategy','Crisis Management','Leadership','Finance','Marketing','Historical Business Cases']))
        await pg.locator('.collection-card:has-text("Finance")').click(); await pg.wait_for_timeout(300)
        t = await pg.inner_text('main'); check('bookmarked season listed in collection', 'season' in t.lower() and await pg.locator('.collection-item').count()>=1)
        await pg.screenshot(path=SHOTS+'/06_collection.png')
        await pg.get_by_role('button', name='Rename').click(); await pg.fill('#rn', 'Money matters'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
        check('rename collection', 'Money matters' in await pg.inner_text('main'))
        await pg.get_by_role('button', name='← All collections').click()
        await pg.fill('#col-search', 'Medici'); await pg.wait_for_timeout(200)
        await pg.fill('#col-search', ''); 

        # ---- notifications
        await pg.goto(B+'/notifications'); await pg.wait_for_timeout(600)
        st = await pg.evaluate("JSON.parse(localStorage.getItem('bizsim.state.v1')).notify")
        check('notifications off by default', not st or not st.get('enabled'))
        await pg.get_by_role('button', name='Turn on notifications').click(); await pg.wait_for_timeout(800)
        st = await pg.evaluate("JSON.parse(localStorage.getItem('bizsim.state.v1')).notify")
        plan = await pg.evaluate("JSON.parse(localStorage.getItem('bizsim.notifyPlan')||'[]')")
        check('turning on schedules a local plan', st and st['enabled'] and len(plan)>=7, f'{len(plan)} planned')
        await pg.screenshot(path=SHOTS+'/07_notifications.png')
        await pg.locator('label:has-text("Case of the Day") input[type=checkbox]').uncheck(); await pg.wait_for_timeout(500)
        plan2 = await pg.evaluate("JSON.parse(localStorage.getItem('bizsim.notifyPlan')||'[]')")
        check('per-category switch removes those notifications', not any(n['category']=='caseOfDay' for n in plan2))
        await pg.locator('label:has-text("Case of the Day") input[type=checkbox]').check(); await pg.wait_for_timeout(300)

        # ---- play a season, finish -> inbox; report; replay + compare
        await pg.goto(B+'/cases/season-c003'); await pg.wait_for_timeout(800)
        n = await play_all(pg)
        await pg.get_by_role('button', name='Insight', exact=True).first.click(); await pg.wait_for_timeout(1500)
        inbox = await pg.evaluate("JSON.parse(localStorage.getItem('bizsim.state.v1')).inbox||[]")
        check('season completed note in the notification centre', any(i['category']=='seasonDone' for i in inbox), f'{len(inbox)} items')
        bell = await pg.locator('.bell-count').count()
        check('bell shows unread count', bell==1)
        await pg.fill('textarea[id^=refl-]', 'Next time I would wait for better data.'); await pg.wait_for_timeout(1000)
        async with pg.expect_download() as d:
            await pg.get_by_role('button', name='Download report (PDF)').click()
        dl = await d.value; pth = await dl.path(); head = open(pth,'rb').read(5); size=os.path.getsize(pth)
        check('PDF report downloads', head==b'%PDF-' and size>4000, f'{size} bytes')
        os.system(f'cp {pth} '+SHOTS+'/report.pdf')
        await pg.get_by_role('button', name='Try a different path').click(); await pg.wait_for_timeout(600)
        n2 = await play_all(pg, from_decisions=True)
        await pg.wait_for_timeout(300)
        cmp = await pg.locator('.compare-table').count()
        check('replay keeps the first attempt and compares paths', cmp==1, f'decisions {n}/{n2}')
        await pg.screenshot(path=SHOTS+'/08_compare.png', full_page=False)
        runs = await pg.evaluate("JSON.parse(localStorage.getItem('bizsim.state.v1')).runs.filter(r=>r.caseId==='season-c003').length")
        check('both attempts preserved', runs>=2, f'{runs} runs')

        # ---- learning profile
        await pg.goto(B+'/learning'); await pg.wait_for_timeout(700)
        t = await pg.inner_text('main')
        check('profile shows sample size and uncertainty', 'how sure are these numbers' in t.lower() and 'n =' in t and 'not a personality' in t)
        await pg.screenshot(path=SHOTS+'/09_learning.png', full_page=True)

        # ---- backups: bad file, then round trip
        await pg.goto(B+'/settings'); await pg.wait_for_timeout(800)
        await pg.locator('input[type=file][accept*="application/json"]').set_input_files(FIX+'/badbackup.json'); await pg.wait_for_timeout(400)
        toasts = await pg.inner_text('body')
        check('unsupported backup refused with a reason', 'cannot read' in toasts or 'Update the app' in toasts)
        async with pg.expect_download() as d:
            await pg.get_by_role('button', name='Download backup').click()
        dl = await d.value; bpath = await dl.path(); backup=json.load(open(bpath))
        check('backup has no device keys or pairing data', 'deviceKeys' not in json.dumps(backup) and 'pairing' not in backup)
        before = await pg.evaluate("JSON.parse(localStorage.getItem('bizsim.state.v1')).runs.length")
        pg.once('dialog', lambda dg: asyncio.ensure_future(dg.accept()))
        await pg.get_by_role('button', name='Reset all data').first.click(); await pg.wait_for_timeout(500)
        mid = await pg.evaluate("JSON.parse(localStorage.getItem('bizsim.state.v1')).runs.length")
        await pg.locator('input[type=file][accept*="application/json"]').set_input_files(bpath); await pg.wait_for_timeout(500)
        t = await pg.inner_text('.dialog'); 
        await pg.screenshot(path=SHOTS+'/10_restore.png')
        await pg.get_by_role('button', name='Merge backup').click(); await pg.wait_for_timeout(500)
        after = await pg.evaluate("JSON.parse(localStorage.getItem('bizsim.state.v1'))")
        check('backup restore preview + merge restores everything', mid==0 and len(after['runs'])==before and len(after['myCases'])==3 and any(c['name']=='Money matters' for c in after['collections']), f'runs {before}->{mid}->{len(after["runs"])}, myCases {len(after["myCases"])}')
        check('restored notifications start switched off', not (after.get('notify') or {}).get('enabled'))

        # ---- mobile layout of new pages
        m = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True, color_scheme='light')
        mp = await m.new_page(); mp.on('pageerror', lambda e: errs.append('mobile:'+str(e)))
        for path,name in [('/', '11_m_home'), ('/collections','12_m_collections'), ('/notifications','13_m_notifications'), ('/cases/season-c155','14_m_case')]:
            await mp.goto(B+path); await mp.wait_for_timeout(1200)
            ow = await mp.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            check(f'mobile {path} has no horizontal overflow', ow<=1, f'overflow {ow}px')
            await mp.screenshot(path=fSHOTS+'/{name}.png')
        await m.close()
        check('no page errors', not errs, '; '.join(sorted(set(errs))[:5]))
        await b.close()
    print('\nRESULT', sum(1 for r in R if r[1]), 'passed,', sum(1 for r in R if not r[1]), 'failed')
asyncio.run(main())
