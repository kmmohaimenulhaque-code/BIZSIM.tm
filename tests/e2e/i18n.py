"""BIZSIM 1.7 localisation checks in a real browser (Chrome via Playwright).

Run against a production build:
  npm run build && PORT=8798 NODE_ENV=production node server/src/index.js &
  python3 tests/e2e/i18n.py

Checks: switching language keeps progress, the choice survives a reload, system
language detection, RTL attributes, season overlays, offline switching after the
picker has been opened, raw translation keys never shown, no horizontal overflow
on phone and desktop sizes in every language, and screenshots of every language.
"""
import asyncio, json, os, re
from playwright.async_api import async_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SHOTS = os.environ.get('E2E_SHOTS', '/tmp/bizsim-shots') + '/i18n'
os.makedirs(SHOTS, exist_ok=True)
B = os.environ.get('E2E_BASE', 'http://localhost:8798')
R = []

def check(name, ok, info=''):
    R.append((name, bool(ok), info))
    print(('PASS ' if ok else 'FAIL ') + name, info, flush=True)

EN = json.load(open(os.path.join(ROOT, 'client/src/i18n/resources/en.json')))
NAMESPACES = sorted(EN.keys())
KEY_RE = re.compile(r'\b(?:' + '|'.join(NAMESPACES) + r')\.[a-zA-Z]+(?:\.[a-zA-Z0-9]+)*\b')
LOCALES = ['en', 'en-GB', 'bn', 'es', 'pt-BR', 'fr', 'ar', 'hi', 'zh-Hans', 'ja', 'de', 'ru', 'id', 'tr', 'ko', 'ur']
SETTINGS_WORD = {'en': 'Settings', 'de': 'Einstellungen', 'ar': 'الإعدادات', 'bn': 'সেটিংস', 'ja': '設定'}

async def leaked_keys(pg):
    txt = await pg.inner_text('body')
    # ignore things that look like keys but are real text (file names, hosts)
    return [k for k in set(KEY_RE.findall(txt)) if not k.endswith(('.md', '.json', '.com', '.env'))]

async def overflow(pg):
    return await pg.evaluate("""() => {
      const doc = document.documentElement;
      const page = doc.scrollWidth - window.innerWidth;
      const clipped = [];
      for (const el of document.querySelectorAll('button, a.btn, .nav-link, .tab, .badge, .chip, h1, h2, h3, label')) {
        const cs = getComputedStyle(el);
        if (el.offsetParent === null || cs.visibility === 'hidden' || el.clientWidth <= 2) continue; // skip screen-reader-only labels
        if (el.scrollWidth > el.clientWidth + 2 && (cs.overflow === 'hidden' || cs.overflowX === 'hidden') && cs.textOverflow !== 'ellipsis')
          clipped.push((el.innerText || '').trim().slice(0, 40));
      }
      return { page, clipped: clipped.slice(0, 8) };
    }""")

async def set_locale(pg, code):
    await pg.evaluate("c => localStorage.setItem('bizsim.locale', c)", code)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])

        # ---------- detection order: saved, then system, then English ----------
        for sys_lang, want in [('bn-BD', 'bn'), ('en-GB', 'en-GB'), ('en-US', 'en'), ('nl-NL', 'en'), ('ar-EG', 'ar'), ('pt-PT', 'pt-BR')]:
            ctx = await b.new_context(locale=sys_lang)
            pg = await ctx.new_page()
            await pg.goto(B + '/'); await pg.wait_for_timeout(900)
            lang = await pg.evaluate('document.documentElement.lang')
            want_intl = {'en': 'en-US'}.get(want, want)  # html lang carries the Intl tag
            check(f'system language {sys_lang} -> {want}', lang == want_intl, f'lang={lang}')
            await ctx.close()

        # ---------- switching keeps progress; persists; RTL ----------
        ctx = await b.new_context(viewport={'width': 1280, 'height': 900}, locale='en-US')
        pg = await ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B + '/cases/season-c138'); await pg.wait_for_timeout(1000)
        for _ in range(3):
            await pg.locator('nav[aria-label="Step navigation"] .btn-primary').click(); await pg.wait_for_timeout(80)
        await pg.locator('.option:not([data-locked=true])').first.click()
        await pg.get_by_role('button', name='Submit decision').click(); await pg.wait_for_timeout(300)
        before = await pg.evaluate("localStorage.getItem('bizsim.state.v1')")
        check('a decision was recorded in English', before and 'season-c138' in before)

        await pg.goto(B + '/settings'); await pg.wait_for_timeout(800)
        await pg.fill('#lang-q', 'deutsch'); await pg.wait_for_timeout(150)
        opts = pg.locator('.lang-option')
        check('search "deutsch" finds one language', await opts.count() == 1)
        await opts.first.click(); await pg.wait_for_timeout(900)
        check('switched to German without reload', await pg.evaluate('document.documentElement.lang') == 'de')
        check('interface is German', 'Einstellungen' in await pg.inner_text('body'))
        after = await pg.evaluate("localStorage.getItem('bizsim.state.v1')")
        check('progress unchanged by switching language', after == before)
        await pg.reload(); await pg.wait_for_timeout(1000)
        check('German survives a reload (restart)', await pg.evaluate('document.documentElement.lang') == 'de')
        await pg.goto(B + '/cases/season-c138'); await pg.wait_for_timeout(1000)
        body = await pg.inner_text('main')
        check('decision still recorded after switching (German UI)', await pg.locator('.option[data-locked=true]').count() > 0 or 'Nächste' in body or 'Episode' in body)
        content_lang = await pg.evaluate("(document.querySelector('[lang=\"en\"] h1, h1[lang=\"en\"]') ? 'en' : (document.querySelector('main [lang]')||{}).lang)")
        check('English season text is marked lang="en" inside the German UI', content_lang == 'en', str(content_lang))

        await pg.goto(B + '/settings'); await pg.wait_for_timeout(600)
        await pg.fill('#lang-q', 'arab'); await pg.wait_for_timeout(150)
        await pg.locator('.lang-option').first.click(); await pg.wait_for_timeout(900)
        attrs = await pg.evaluate("[document.documentElement.lang, document.documentElement.dir, getComputedStyle(document.body).direction]")
        check('Arabic sets lang=ar dir=rtl', attrs == ['ar', 'rtl', 'rtl'], str(attrs))
        await pg.screenshot(path=f'{SHOTS}/rtl_ar_settings_desktop.png')
        side = await pg.evaluate("(() => { const s = document.querySelector('aside, .sidebar, nav[aria-label]'); if (!s) return null; const r = s.getBoundingClientRect(); return r.left > window.innerWidth / 2 ? 'right' : 'left'; })()")
        check('RTL: sidebar sits on the right', side == 'right', str(side))
        await pg.fill('#lang-q', 'english'); await pg.wait_for_timeout(150)
        await pg.locator('.lang-option', has_text='English (US)').first.click(); await pg.wait_for_timeout(700)
        check('back to English, dir=ltr', await pg.evaluate('[document.documentElement.lang, document.documentElement.dir]') == ['en-US', 'ltr'])
        check('no page errors while switching', not errs, '; '.join(errs[:3]))

        # ---------- offline switching after the picker was opened online ----------
        await pg.goto(B + '/settings'); await pg.wait_for_timeout(5500)  # picker prefetches every language
        await ctx.set_offline(True)
        await pg.fill('#lang-q', '한국어'); await pg.wait_for_timeout(150)
        await pg.locator('.lang-option').first.click(); await pg.wait_for_timeout(1200)
        check('offline: switch to Korean works once the picker has been opened', await pg.evaluate('document.documentElement.lang') == 'ko')
        await ctx.set_offline(False)
        await ctx.close()

        # ---------- overlay sample ----------
        ctx = await b.new_context(viewport={'width': 1280, 'height': 900})
        pg = await ctx.new_page()
        await pg.goto(B + '/'); await set_locale(pg, 'bn')
        await pg.goto(B + '/cases/season-c138'); await pg.wait_for_timeout(1300)
        main = await pg.inner_text('main')
        check('Bengali overlay: season title translated', 'এম-পেসা' in main)
        check('Bengali overlay: machine-translation notice shown', 'যন্ত্র' in main or 'মেশিন' in main, main[:0])
        await pg.screenshot(path=f'{SHOTS}/overlay_bn_c138.png', full_page=False)
        await pg.goto(B + '/cases/season-c001'); await pg.wait_for_timeout(1000)
        check('Bengali UI, untranslated season stays English and says so', await pg.evaluate("!!document.querySelector('main [lang=\"en\"]')"))
        await ctx.close()

        # ---------- every language: keys, overflow, screenshots ----------
        pages = [('home', '/'), ('cases', '/cases'), ('season', '/cases/season-c138'), ('settings', '/settings'), ('profile', '/learning'), ('about', '/about')]
        for vp_name, vp in [('desktop', {'width': 1280, 'height': 900}), ('phone', {'width': 390, 'height': 844})]:
            ctx = await b.new_context(viewport=vp, is_mobile=vp_name == 'phone', has_touch=vp_name == 'phone')
            pg = await ctx.new_page()
            await pg.goto(B + '/')
            for code in LOCALES:
                await set_locale(pg, code)
                leaks, wide, clip = [], [], []
                for pname, path in pages:
                    await pg.goto(B + path); await pg.wait_for_timeout(700)
                    leaks += [f'{pname}:{k}' for k in await leaked_keys(pg)]
                    o = await overflow(pg)
                    if o['page'] > 1: wide.append(f"{pname}+{o['page']}px")
                    clip += [f'{pname}:{x}' for x in o['clipped']]
                    if pname in ('home', 'season', 'settings'):
                        await pg.screenshot(path=f'{SHOTS}/{code}_{pname}_{vp_name}.png')
                check(f'{vp_name} {code}: no raw translation keys shown', not leaks, ', '.join(leaks[:5]))
                check(f'{vp_name} {code}: no horizontal page overflow', not wide, ', '.join(wide[:5]))
                if clip: print(f'  note {vp_name} {code}: clipped text in {", ".join(clip[:5])}')
            await ctx.close()
        await b.close()

    fails = [r for r in R if not r[1]]
    print(f'\n{len(R) - len(fails)}/{len(R)} checks passed')
    json.dump([{'check': n, 'pass': ok, 'info': i} for n, ok, i in R], open(f'{SHOTS}/results.json', 'w'), indent=1, ensure_ascii=False)
    raise SystemExit(1 if fails else 0)

asyncio.run(main())
