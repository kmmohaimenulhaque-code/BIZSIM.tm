# End-to-end checks

Browser and desktop checks used for the 1.6 release (see docs/VERIFICATION-1.6.md). They need Python 3 with Playwright, Google Chrome (set `CHROME` to its path if it is not found), and for the desktop scripts `xvfb-run` and a Linux build in `release/linux-unpacked`.

```bash
node tests/e2e/make-fixtures.mjs                 # test packages and QR images in $E2E_FIXTURES (default /tmp/bizsim-e2e)
npm run build && PORT=8798 NODE_ENV=production node server/src/index.js &
python3 tests/e2e/web.py                         # 43 checks against http://localhost:8798
python3 tests/e2e/play-all.py ALL                # plays all 200 seasons
# pairing: a desktop-mode server and a static server for the "other website" check
BIZSIM_DESKTOP=1 BIZSIM_PAIR_HOSTS=127.0.0.1 PORT=8799 HOST=127.0.0.1 node server/src/index.js &
(cd client/dist && python3 -m http.server 8811) &
python3 tests/e2e/pairing.py
python3 tests/e2e/desktop.py                     # Linux app under Xvfb
OLD_APP=/path/to/1.5/bizsim python3 tests/e2e/upgrade.py
```

Screenshots go to `$E2E_SHOTS` (default /tmp/bizsim-shots).
