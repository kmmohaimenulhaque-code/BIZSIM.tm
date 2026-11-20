import os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
FIX=os.environ.get('E2E_FIXTURES','/tmp/bizsim-e2e')
SHOTS=os.environ.get('E2E_SHOTS','/tmp/bizsim-shots')
os.makedirs(SHOTS, exist_ok=True)
import asyncio, json, re
from playwright.async_api import async_playwright
D='http://127.0.0.1:8799'
R=[]
def check(name, ok, info=''):
    R.append((name, bool(ok))); print(('PASS ' if ok else 'FAIL ')+name, info, flush=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])
        desk = await (await b.new_context(viewport={'width':1280,'height':900})).new_page()
        errs=[]; desk.on('pageerror', lambda e: errs.append(str(e)))
        await desk.goto(D+'/settings'); await desk.wait_for_timeout(1500)
        await desk.get_by_role('button', name='Turn on phone access').click(); await desk.wait_for_timeout(1200)
        st = await desk.evaluate("fetch('/api/share').then(r=>r.json())")
        url = [u for u in st['urls'] if '127.0.0.1' in u][0]
        check('pairing link uses a fragment secret', re.search(r'/#pair=[\w-]+\.[\w-]{16,}$', url) is not None, url[:60]+'…')
        check('pairing code expires', st['expiresAt'] - int(__import__('time').time()*1000) <= 5*60*1000+2000)
        t = await desk.inner_text('main')
        check('desktop shows countdown', 'Code expires in' in t)
        await desk.screenshot(path=SHOTS+'/20_pair_desktop.png')

        # security: another website must not read the pairing secret from localhost
        other = await (await b.new_context()).new_page()
        await other.goto('http://localhost:8811/'); await other.wait_for_timeout(300)
        r = await other.evaluate("fetch('http://127.0.0.1:8799/api/share').then(r=>r.status).catch(e=>'blocked:'+e.message)")
        check('cross-site page cannot read the pairing secret', r==403 or str(r).startswith('blocked'), str(r))
        r = await other.evaluate("fetch('http://127.0.0.1:8799/api/keys',{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'}).then(r=>r.status).catch(e=>'blocked')")
        check('cross-site page cannot change saved keys', r in (403,'blocked'), str(r))

        # phone (browser) opens the pairing link
        lan = url.split('/#')[0]
        phone_ctx = await b.new_context(viewport={'width':390,'height':844}, is_mobile=True)
        phone = await phone_ctx.new_page(); phone.on('pageerror', lambda e: errs.append('phone:'+str(e)))
        await phone.goto(url); await phone.wait_for_timeout(2500)
        check('secret removed from the address bar', 'pair=' not in phone.url, phone.url)
        pairing = await phone.evaluate("JSON.parse(localStorage.getItem('bizsim.pairing')||'null')")
        check('phone stores a session, not the secret', pairing and pairing.get('sessionId') and 'secret' not in json.dumps(pairing))
        s = await phone.evaluate("import('/assets/'+'').catch(()=>null)")
        status = await phone.evaluate("""(async()=>{const m=await fetch('/api/status');return m.status})()""")
        check('unsigned API call from the phone is refused', status==401, str(status))
        # signed call via the app: open Research page which calls status
        await phone.goto(lan+'/settings'); await phone.wait_for_timeout(2500)
        t = await phone.inner_text('main')
        check('phone app talks to the computer with signed requests', 'Connected · BIZSIM 1.6.0' in t)
        await phone.screenshot(path=SHOTS+'/21_pair_phone.png')

        # replay a captured request
        cap = {}
        def on_req(req):
            if '/api/status' in req.url and 'x-bizsim-sig' in req.headers: cap['h']=req.headers
        phone.on('request', on_req)
        await phone.reload(); await phone.wait_for_timeout(2000)
        h = cap.get('h')
        if h:
            hdr = {k:v for k,v in h.items() if k.startswith('x-bizsim')}
            import urllib.request, urllib.error
            try:
                rr = urllib.request.urlopen(urllib.request.Request(lan+'/api/status', headers=hdr)).status
            except urllib.error.HTTPError as e:
                rr = e.code; body = e.read().decode()
            check('captured request cannot be replayed (sent again without a browser)', rr==401 and 'Repeated' in body, f'{rr} {body[:60]}')
        else: check('captured request cannot be replayed', False, 'no request captured')

        # desktop lists and revokes the device
        await desk.wait_for_timeout(4500)
        t = await desk.inner_text('main')
        check('desktop lists the paired device', 'Browser on' in t)
        await desk.get_by_role('button', name=re.compile('^Remove Browser')).first.click(); await desk.wait_for_timeout(800)
        await phone.goto(lan+'/settings'); await phone.wait_for_timeout(2500)
        pairing = await phone.evaluate("JSON.parse(localStorage.getItem('bizsim.pairing')||'null')")
        t = await phone.inner_text('body')
        check('revoked phone is told and forgets the pairing', pairing is None and ('no longer paired' in t or 'Not reachable' in t), (t[:0]))

        # used code cannot be reused
        await phone.goto(url); await phone.wait_for_timeout(2500)
        t = await phone.inner_text('body')
        check('a used pairing code is refused', 'expired or was already used' in t)

        # expired-code UI path: new code button rotates
        old = st['urls'][0]
        await desk.get_by_role('button', name='New code').click(); await desk.wait_for_timeout(800)
        st2 = await desk.evaluate("fetch('/api/share').then(r=>r.json())")
        check('new code rotates the secret', st2['urls'][0]!=old)
        await desk.get_by_role('button', name='Turn off phone access').click(); await desk.wait_for_timeout(800)
        rr = await phone.evaluate("fetch('"+lan+"/api/pair/hello').then(r=>r.status).catch(()=> 'closed')")
        check('turning off closes the Wi-Fi listener', rr=='closed', str(rr))
        check('no page errors', not errs, '; '.join(errs[:3]))
        await b.close()
    print('RESULT', sum(1 for r in R if r[1]), 'passed,', sum(1 for r in R if not r[1]), 'failed')
asyncio.run(main())
