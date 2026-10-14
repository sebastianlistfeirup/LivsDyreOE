"""Touch/browser QA for Livs magiske akvarie against a local Vite server.

Run: python tests/aquarium_mobile.py
Set LIVS_TEST_URL to override http://127.0.0.1:4173/LivsDyreOE/.
Set LIVS_TEST_PRODUCTION=1 for a built site; fixed winning actions then replace
the development-only engine import. Every action still uses browser controls.
"""

import json
import os
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, sync_playwright


URL = os.environ.get("LIVS_TEST_URL", "http://127.0.0.1:4173/LivsDyreOE/")
SAVE_KEY = "livs-akvarie.save.v1"
ENGINE_URL = "/LivsDyreOE/src/aquarium/core/index.ts"
PRODUCTION = os.environ.get("LIVS_TEST_PRODUCTION") == "1"
# Captured from the deterministic, shipped level seeds using the same hint
# policy as the development browser run. A production build exposes no TS
# source or debug hooks; this fixture exercises its public touch UI only.
WINNING_PATHS = json.loads((Path(__file__).parent / "aquarium" / "paths.json").read_text(encoding="utf-8"))
assert [path["level"] for path in WINNING_PATHS] == list(range(1, 31))
GATES = {6: 60, 14: 80, 22: 80}
TOTAL_SHELLS = 40 + 30 * 40 - sum(GATES.values())


def dismiss_tutorial(page):
    tutorial = page.locator('[data-action="tutorial-done"]')
    if tutorial.count() and tutorial.is_visible():
        level = int(tutorial.get_attribute('data-id'))
        tutorial.tap()
        assert level in saved(page)["adventure"]["seenTutorials"]


def close_modal(page):
    page.locator('#modal [data-action="close-modal"]').first.tap()
    # A touch compatibility click must not hit a newly exposed button after
    # closing the dialog (for example, Projects underneath Settings' close).
    page.wait_for_function("() => !document.querySelector('#modal').open", timeout=3000)


def saved(page):
    raw = page.evaluate("key => localStorage.getItem(key)", SAVE_KEY)
    assert raw, "The game did not save its initial state"
    return json.loads(raw)


def wait_settled(page, old_turn):
    page.wait_for_function(
        """({key,oldTurn}) => {
          const raw = localStorage.getItem(key);
          if (!raw) return false;
          const save = JSON.parse(raw);
          return save.active.board.turnId === oldTurn + 1 &&
            save.active.pending === null &&
            document.querySelector('#board') &&
            document.querySelector('#board').getAttribute('aria-busy') !== 'true';
        }""",
        arg={"key": SAVE_KEY, "oldTurn": old_turn}, timeout=30000,
    )
    if all(o["collected"] >= o["target"] for o in saved(page)["active"]["board"]["objectives"]):
        page.wait_for_function(
            "key => JSON.parse(localStorage.getItem(key)).active.rewarded === true",
            arg=SAVE_KEY, timeout=10000,
        )


def engine_hint(page, board):
    if PRODUCTION:
        actions = WINNING_PATHS[board["levelId"] - 1]["actions"]
        assert board["turnId"] < len(actions), (board["levelId"], board["turnId"])
        return actions[board["turnId"]]
    return page.evaluate(
        """async ({board,url}) => {
          const engine = await import(url);
          return engine.getHint(board);
        }""",
        {"board": board, "url": ENGINE_URL},
    )


def tap_action(page, action):
    before = saved(page)["active"]["board"]["turnId"]
    try:
        if action["kind"] == "swap":
            page.locator(f'.gem[data-cell="{action["from"]}"]').tap()
            page.locator(f'.gem[data-cell="{action["to"]}"]').tap()
        else:
            page.locator(f'.gem[data-cell="{action["cell"]}"]').tap()
            page.locator('[data-action="use-special"]').tap()
        wait_settled(page, before)
    except PlaywrightTimeoutError as error:
        page.screenshot(path='/tmp/livs-akvarie-turn-failure.png', full_page=True)
        active = saved(page)['active']
        detail = {"level": active['board']['levelId'], "turn": active['board']['turnId'], "pending": active['pending'], "rewarded": active['rewarded'], "busy": page.locator('#board').get_attribute('aria-busy')}
        raise AssertionError(f"Touch turn did not settle: action={action}, before={before}, after={detail}; screenshot /tmp/livs-akvarie-turn-failure.png") from error


def mobile_page(browser, width=390, height=844):
    context = browser.new_context(
        viewport={"width": width, "height": height},
        device_scale_factor=2, is_mobile=True, has_touch=True,
        accept_downloads=True,
    )
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    if PRODUCTION:
        page.on('response', lambda response: errors.append(f'HTTP {response.status}: {response.url}') if response.status >= 400 and response.url.startswith(URL.split('/LivsDyreOE/')[0]) else None)
    page.goto(URL, wait_until="networkidle")
    page.locator('#board .gem').first.wait_for()
    page.wait_for_function("() => document.querySelectorAll('#board .gem').length >= 36")
    assert 'Livs magiske akvarie' in page.title()
    return context, page, errors


def set_reduced_motion(page):
    page.locator('[data-action="settings"]').tap()
    page.locator('[data-setting="reducedMotion"]').check()
    close_modal(page)
    assert saved(page)["settings"]["reducedMotion"] is True


def play_all_thirty(browser):
    context, page, errors = mobile_page(browser)
    if PRODUCTION:
        print('Production bundle: ' + page.locator('script[type="module"][src]').first.get_attribute('src'), flush=True)
    assert saved(page)["shells"] == 40
    page.screenshot(path="/tmp/livs-akvarie-first-phone.png", full_page=True)
    set_reduced_motion(page)
    winning_checkpoint = None
    winning_action = None
    terrain_replay = None
    move_counts = []
    art_signatures = []
    shapes = []
    project_spending = 0
    for level in range(1, 31):
        print(f'Touch-playing level {level}', flush=True)
        assert saved(page)["active"]["board"]["levelId"] == level
        dismiss_tutorial(page)
        assert f'Bane {level} af 30' in page.locator('#level-badge').inner_text()
        assert page.locator('body').get_attribute('data-gem-theme') == str(level - 1)
        assert page.locator('body').get_attribute('data-region') == ('sun' if level <= 6 else 'coral' if level <= 14 else 'pearl' if level <= 22 else 'star')
        # The objective preview must match the actual jewel, including its new theme.
        opening_board = saved(page)["active"]["board"]
        page.wait_for_function("()=>[...document.querySelectorAll('#board .gem img')].every(image=>image.complete&&image.naturalWidth>0)")
        shapes.append(tuple(opening_board['voids']))
        assert page.locator('#board .gem').count() == sum(tile is not None for tile in opening_board['tiles'])
        assert page.locator('#board .void-cell').count() == sum(opening_board['voids'])
        art_signatures.append(tuple(page.locator(f'.gem[data-cell="{next(i for i,t in enumerate(opening_board["tiles"]) if t and t["type"]==kind and not t.get("special"))}"] img').get_attribute('src') for kind in range(5)))
        for objective in opening_board['objectives']:
            kinds = ('shell', 'star', 'drop', 'leaf', 'pearl')
            if objective['kind'] not in kinds:
                continue
            tile_type = kinds.index(objective['kind'])
            cell = next(i for i, tile in enumerate(opening_board['tiles'])
                        if tile and tile['type'] == tile_type and not tile.get('special'))
            expected_art = page.locator(f'.gem[data-cell="{cell}"] img').get_attribute('src')
            assert page.locator(f'.objective[data-kind="{objective["kind"]}"] img').get_attribute('src') == expected_art
        moves = 0
        while not saved(page)["active"]["rewarded"]:
            current = saved(page)
            board = current["active"]["board"]
            assert board["movesRemaining"] > 0, (level, moves, board["objectives"])
            action = engine_hint(page, board)
            assert action, (level, moves)
            before = current
            tap_action(page, action)
            moves += 1
            if level == 26 and moves == 1:
                terrain_replay = (before, action, saved(page))
            if level == 1 and saved(page)["active"]["rewarded"]:
                winning_checkpoint = before
                winning_action = action
            assert moves <= opening_board['movesRemaining'], (level, moves)
        move_counts.append(moves)
        current = saved(page)
        assert current["shells"] == 40 + level * 40 - project_spending, (level, current["shells"])
        assert current['adventure']['reefSavings'] == min(220, level * 10) - project_spending
        assert current["claimed"] == list(range(1, level + 1))
        assert current["completed"] == current["claimed"]
        assert page.locator('#modal').is_visible()
        if level == 1:
            page.reload(wait_until="networkidle")
            assert saved(page)["shells"] == 80
            assert saved(page)["claimed"] == [1]
        if level in GATES:
            # The next region really is locked until the visible reef project is built.
            close_modal(page)
            page.locator('[data-action="levels"]').tap()
            assert page.locator(f'[data-action="choose-level"][data-id="{level+1}"]').is_disabled()
            page.locator('#modal [data-action="projects"]').first.tap()
            restore = page.locator('#modal [data-action="restore-reef"]').first
            assert restore.is_enabled()
            reserve_before = saved(page)['adventure']['reefSavings']
            restore.tap()
            project_spending += GATES[level]
            current = saved(page)
            assert current['shells'] == 40 + level * 40 - project_spending
            assert current['adventure']['reefSavings'] == reserve_before - GATES[level]
            assert current['adventure']['reefStage'] == list(GATES).index(level) + 1
            page.locator('[data-action="aquarium"]').tap()  # Back from restored aquarium to the board.
            page.locator('[data-action="levels"]').tap()
            page.locator(f'[data-action="choose-level"][data-id="{level+1}"]').tap()
        elif level < 30:
            if page.locator('#modal [data-action="next-level"]').count():
                page.locator('[data-action="next-level"]').tap()
            else:
                page.locator('[data-action="levels"]').tap()
                page.locator(f'[data-action="choose-level"][data-id="{level + 1}"]').tap()
        if level < 30:
            page.wait_for_function(
                "({key,id}) => JSON.parse(localStorage.getItem(key)).active.board.levelId === id",
                arg={"key": SAVE_KEY, "id": level + 1},
            )
    assert saved(page)["shells"] == TOTAL_SHELLS
    assert saved(page)["completed"] == list(range(1, 31))
    assert saved(page)['adventure']['reefStage'] == 3
    assert saved(page)['adventure']['reefSavings'] == 0
    assert len(set(shapes)) == 30, 'Every level needs its own board silhouette'
    assert len(set(art_signatures)) == 30, 'Every level needs a distinct jewel appearance'
    fresh_tab = context.new_page()
    fresh_tab.goto(URL, wait_until="networkidle")
    assert saved(fresh_tab)["shells"] == TOTAL_SHELLS
    assert saved(fresh_tab)["completed"] == list(range(1, 31))
    fresh_tab.close()
    page.screenshot(path="/tmp/livs-magiske-akvarie-thirty-wins.png", full_page=True)
    assert not errors, errors
    assert winning_checkpoint and winning_action
    assert terrain_replay
    return context, page, winning_checkpoint, winning_action, move_counts, terrain_replay


def open_checkpoint(browser, checkpoint):
    context, page, errors = mobile_page(browser)
    page.evaluate(
        "({key,save}) => localStorage.setItem(key, JSON.stringify(save))",
        {"key": SAVE_KEY, "save": checkpoint},
    )
    page.reload(wait_until="networkidle")
    assert saved(page)["active"]["board"] == checkpoint["active"]["board"]
    set_reduced_motion(page)
    return context, page, errors


def interrupted_winning_turn(browser, checkpoint, action):
    normal_context, normal, normal_errors = open_checkpoint(browser, checkpoint)
    tap_action(normal, action)
    expected = saved(normal)
    assert expected["shells"] == checkpoint["shells"] + 40
    assert expected["claimed"] == [1]

    interrupted_context, interrupted, interrupted_errors = open_checkpoint(browser, checkpoint)
    old_turn = saved(interrupted)["active"]["board"]["turnId"]
    if action["kind"] == "swap":
        interrupted.locator(f'.gem[data-cell="{action["from"]}"]').tap()
        interrupted.locator(f'.gem[data-cell="{action["to"]}"]').tap()
    else:
        interrupted.locator(f'.gem[data-cell="{action["cell"]}"]').tap()
        interrupted.locator('[data-action="use-special"]').tap()
    interrupted.wait_for_function(
        "key => !!JSON.parse(localStorage.getItem(key)).active.pending",
        arg=SAVE_KEY,
    )
    assert interrupted.locator('#board').get_attribute('aria-busy') == 'true'
    interrupted.reload(wait_until="networkidle")
    interrupted.wait_for_function(
        "key => JSON.parse(localStorage.getItem(key)).active.rewarded === true",
        arg=SAVE_KEY,
    )
    recovered = saved(interrupted)
    assert recovered["active"]["board"] == expected["active"]["board"]
    assert recovered["active"]["board"]["turnId"] == old_turn + 1
    assert recovered["active"]["pending"] is None
    assert recovered["shells"] == expected["shells"] == 80
    assert recovered["claimed"] == expected["claimed"] == [1]
    assert recovered['adventure'] == expected['adventure']
    interrupted.reload(wait_until="networkidle")
    assert saved(interrupted)["shells"] == 80
    assert saved(interrupted)["claimed"] == [1]
    assert not normal_errors and not interrupted_errors, (normal_errors, interrupted_errors)
    normal_context.close()
    interrupted_context.close()


def pending_legacy_and_terrain(browser, checkpoint, action, terrain_replay):
    # A genuinely old level-one board has all 64 cells, no new terrain fields,
    # no adventure state, and the same still-uncommitted action intent.
    context, page, errors = mobile_page(browser)
    legacy = json.loads(json.dumps(checkpoint))
    legacy.pop('adventure', None)
    for field in ('voids', 'rocks', 'clams', 'bubbles', 'gravity'):
        legacy['active']['board'].pop(field, None)
    legacy['active']['pending'] = action
    page.evaluate('({key,save})=>localStorage.setItem(key,JSON.stringify(save))', {'key': SAVE_KEY, 'save': legacy})
    page.reload(wait_until='networkidle')
    page.wait_for_function('key=>JSON.parse(localStorage.getItem(key)).active.rewarded', arg=SAVE_KEY)
    restored = saved(page)
    assert restored['active']['legacy'] is True
    assert restored['active']['board']['turnId'] == checkpoint['active']['board']['turnId'] + 1
    assert restored['active']['board']['movesRemaining'] == checkpoint['active']['board']['movesRemaining'] - 1
    assert restored['active']['pending'] is None
    assert restored['shells'] == 80 and restored['claimed'] == [1]
    assert restored['adventure']['reefSavings'] == 10
    page.reload(wait_until='networkidle')
    assert saved(page)['shells'] == 80
    assert saved(page)['active']['board'] == restored['active']['board']
    assert not errors, errors
    context.close()

    before, pending_action, expected = terrain_replay
    context, page, errors = mobile_page(browser)
    pending = json.loads(json.dumps(before))
    pending['active']['pending'] = pending_action
    page.evaluate('({key,save})=>localStorage.setItem(key,JSON.stringify(save))', {'key': SAVE_KEY, 'save': pending})
    page.reload(wait_until='networkidle')
    recovered = saved(page)
    assert recovered['active']['board'] == expected['active']['board']
    assert recovered['active']['pending'] is None
    assert recovered['shells'] == before['shells']
    assert recovered['adventure'] == before['adventure']
    page.reload(wait_until='networkidle')
    assert saved(page)['active']['board'] == recovered['active']['board']
    assert not errors, errors
    context.close()
    print('Legacy pending win and new-terrain/current pending turn both recover exactly once', flush=True)


def protected_reserve(browser, checkpoint, action):
    context, page, errors = open_checkpoint(browser, checkpoint)
    tap_action(page, action)
    assert saved(page)['shells'] == 80 and saved(page)['adventure']['reefSavings'] == 10
    page.locator('[data-action="win-decorate"]').tap()
    page.locator('[data-action="levels"]').tap()
    page.locator('[data-action="fish-card"][data-id="sky"]').tap()
    page.locator('[data-action="buy-fish"][data-id="sky"]').tap()
    assert saved(page)['shells'] == 40 and saved(page)['adventure']['reefSavings'] == 10
    page.locator('[data-action="hint"]').tap()
    page.locator('[data-action="select-decor"][data-id="lantern"]').tap()
    before = saved(page)
    page.locator('.aq-slot[data-slot="0"]').tap()
    assert saved(page) == before, 'A 35-shell item must not spend the 10 reserved shells out of a 40-shell wallet'
    assert 'mangler' in page.locator('#toast').inner_text().lower()
    assert saved(page)['adventure']['reefSavings'] == 10
    assert not errors, errors
    context.close()
    print('Protected reef savings cannot be spent in the decoration shop', flush=True)


def corrupt_save_recovery(browser, checkpoint):
    context, page, errors = mobile_page(browser)
    broken = '{"project":"livs-akvarie","unfinished":'
    page.evaluate('''({key,backup,broken})=>{localStorage.setItem(key+'.backup',JSON.stringify(backup));localStorage.setItem(key,broken)}''', {'key': SAVE_KEY, 'backup': checkpoint, 'broken': broken})
    page.reload(wait_until='networkidle')
    assert page.evaluate('key=>localStorage.getItem(key)', SAVE_KEY) == broken
    assert page.locator('[data-action="recover-backup"]').is_visible()
    page.locator('[data-action="recover-backup"]').tap()
    page.wait_for_function('key=>{try{return JSON.parse(localStorage.getItem(key)).project==="livs-akvarie"}catch{return false}}', arg=SAVE_KEY)
    assert saved(page)['active']['board'] == checkpoint['active']['board']
    assert saved(page)['shells'] == checkpoint['shells']
    page.evaluate('''({key,broken})=>{localStorage.removeItem(key+'.backup');localStorage.setItem(key,broken)}''', {'key': SAVE_KEY, 'broken': broken})
    page.reload(wait_until='networkidle')
    assert page.evaluate('key=>localStorage.getItem(key)', SAVE_KEY) == broken
    assert page.locator('[data-action="recover-backup"]').count() == 0
    assert page.locator('[data-action="fresh-after-error"]').is_visible()
    assert not errors, errors
    context.close()
    print('Corrupt main saves remain untouched until explicit backup recovery or fresh-start choice', flush=True)


def shop_and_import(page):
    page.locator('[data-action="win-decorate"]').tap()
    page.locator('[data-action="hint"]').tap()  # Open the decoration catalogue.
    page.locator('[data-action="select-decor"][data-id="seagrass"]').tap()
    page.locator('.aq-slot[data-slot="0"]').tap()
    assert saved(page)["shells"] == TOTAL_SHELLS - 15
    assert saved(page)["placements"] == [{"id": "seagrass", "slot": 0, "rotation": 0}]

    page.locator('.aq-slot[data-slot="0"]').tap()
    page.locator('.aq-slot[data-slot="1"]').tap()
    assert saved(page)["shells"] == TOTAL_SHELLS - 15
    assert saved(page)["placements"][0]["slot"] == 1
    page.locator('[data-action="undo-decor"]').tap()
    assert saved(page)["placements"][0]["slot"] == 0

    page.locator('.aq-slot[data-slot="0"]').tap()
    page.locator('[data-action="rotate-decor"]').tap()
    assert saved(page)["placements"][0]["rotation"] == 1
    page.locator('[data-action="sell-decor"]').tap()
    page.locator('[data-action="confirm-sell"]').tap()
    assert saved(page)["shells"] == TOTAL_SHELLS
    assert saved(page)["decorations"] == []

    page.locator('[data-action="levels"]').tap()  # Fish catalogue in aquarium mode.
    page.locator('[data-action="fish-card"][data-id="sky"]').tap()
    page.locator('[data-action="buy-fish"][data-id="sky"]').tap()
    assert saved(page)["shells"] == TOTAL_SHELLS - 40
    assert 'sky' in saved(page)["fishIds"]

    page.locator('[data-action="settings"]').tap()
    with page.expect_download() as transfer:
        page.locator('[data-action="export"]').tap()
    download = transfer.value
    exported = json.loads(open(download.path(), encoding="utf-8").read())
    assert exported["shells"] == TOTAL_SHELLS - 40
    before_bad_import = saved(page)
    page.locator('#import-file').set_input_files({
        "name": "broken.json", "mimeType": "application/json", "buffer": b'{"project":"bad"}',
    })
    assert 'ikke en gyldig' in page.locator('#toast').inner_text()
    assert saved(page) == before_bad_import

    page.locator('[data-action="close-modal"]').tap()
    page.locator('[data-action="levels"]').tap()
    page.locator('[data-action="fish-card"][data-id="sky"]').tap()
    page.locator('#fish-name').fill('Havstjerne')
    page.locator('[data-action="save-fish"]').tap()
    assert saved(page)["fishStyles"]["sky"]["name"] == 'Havstjerne'
    page.locator('[data-action="settings"]').tap()
    page.locator('#import-file').set_input_files({
        "name": "saved.json", "mimeType": "application/json", "buffer": json.dumps(exported).encode(),
    })
    page.locator('#confirm-import').tap()
    page.wait_for_function(
        "key => !JSON.parse(localStorage.getItem(key)).fishStyles.sky",
        arg=SAVE_KEY,
    )
    assert saved(page)["shells"] == TOTAL_SHELLS - 40
    assert 'sky' in saved(page)["fishIds"]


def upgrades_stories_and_postcard(page):
    """All purchases use earned shells from the actual thirty-level run."""
    page.locator('[data-action="win-decorate"]').tap()
    initial = saved(page)['shells']
    page.locator('[data-action="hint"]').tap()
    page.locator('[data-action="select-decor"][data-id="cave"]').tap()
    page.locator('.aq-slot[data-slot="0"]').tap()
    assert saved(page)['shells'] == initial - 20
    for tier, price in ((1, 40), (2, 70)):
        before = saved(page)['shells']
        page.locator('.aq-slot[data-slot="0"]').tap()
        page.locator('[data-action="upgrade-preview"][data-id="cave"]').tap()
        page.locator('[data-action="upgrade-decor"][data-id="cave"]').tap()
        assert saved(page)['adventure']['upgrades']['cave'] == tier
        assert saved(page)['shells'] == before - price
    assert page.locator('.aq-slot[data-slot="0"] .aq-upgrade-badge').count() == 1
    for chapter in (1, 2):
        page.locator('[data-action="levels"]').tap()
        page.locator('[data-action="fish-card"][data-id="sky"]').tap()
        page.locator('[data-action="fish-story"][data-id="sky"]').tap()
        assert saved(page)['adventure']['stories']['sky'] == chapter
    page.locator('.aq-slot[data-slot="0"]').tap()
    page.locator('[data-action="sell-decor"]').tap()
    assert '130' in page.locator('#modal').inner_text()
    page.locator('[data-action="confirm-sell"]').tap()
    assert saved(page)['shells'] == initial, 'Selling must refund the base decoration and both upgrades'
    assert 'cave' not in saved(page)['adventure']['upgrades']
    assert saved(page)['adventure']['stories']['sky'] == 2, 'Happy memories must survive a harmless decoration sale'

    page.locator('[data-action="ambience"]').tap()
    page.locator('[data-action="lighting"][data-id="moon"]').tap()
    assert saved(page)['adventure']['lighting'] == 'moon'
    page.locator('[data-action="view-region"][data-id="pearl"]').tap()
    assert saved(page)['adventure']['region'] == 'pearl'
    with page.expect_download(timeout=30000) as transfer:
        page.locator('[data-action="postcard"]').tap()
    postcard = transfer.value
    assert postcard.suggested_filename.startswith('livs-magiske-akvarie-')
    with open(postcard.path(), 'rb') as stream:
        header = stream.read(24)
    assert header[:8] == b'\x89PNG\r\n\x1a\n'
    assert int.from_bytes(header[16:20], 'big') >= 390
    assert int.from_bytes(header[20:24], 'big') >= 600
    page.reload(wait_until='networkidle')
    assert saved(page)['adventure']['lighting'] == 'moon'
    assert saved(page)['adventure']['region'] == 'pearl'
    assert saved(page)['adventure']['stories']['sky'] == 2
    print('Two cave upgrades, both Sky stories, full 130-shell refund, lighting/region persistence and PNG postcard export passed', flush=True)


def check_viewport(browser, width, height):
    context, page, errors = mobile_page(browser, width, height)
    sizes = page.evaluate("""() => {
      const board = document.querySelector('#board').getBoundingClientRect();
      const controls = [...document.querySelectorAll('.game-header button,.game-toolbar button,.goal-help')]
        .filter(node => node.getBoundingClientRect().width > 0)
        .map(node => ({name: node.getAttribute('aria-label') || node.textContent.trim(),
          width: node.getBoundingClientRect().width,height: node.getBoundingClientRect().height}));
      return {bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth,
        board: {x:board.x,y:board.y,width:board.width,height:board.height}, controls};
    }""")
    assert sizes['bodyWidth'] <= width + 1, (width, height, sizes)
    box = sizes['board']
    assert box['width'] >= 200 and box['x'] >= -1 and box['x'] + box['width'] <= width + 1, (width, height, box)
    assert box['y'] >= -1 and box['y'] + box['height'] <= height + 1, (width, height, box)
    small_controls = [control for control in sizes['controls'] if control['width'] < 48 or control['height'] < 48]
    assert not errors, (width, height, errors)
    page.screenshot(path=f'/tmp/livs-akvarie-{width}x{height}.png', full_page=True)
    context.close()
    return [(width, height, control) for control in small_controls]


def check_production_offline(browser):
    context, page, errors = mobile_page(browser)
    page.evaluate("async () => { await navigator.serviceWorker.ready; return true; }")
    page.wait_for_function("() => navigator.serviceWorker.controller !== null", timeout=15000)
    assert page.evaluate("() => navigator.serviceWorker.controller.scriptURL.endsWith('/LivsDyreOE/sw.js')")
    cached = page.evaluate("async()=>{const names=(await caches.keys()).filter(name=>name.startsWith('livs-akvarie-'));const cache=await caches.open(names.at(-1));return(await cache.keys()).map(request=>request.url)}")
    assert sum('/jewels/level-' in url for url in cached) == 150, 'All five jewels for all thirty levels must be available offline'
    for region in ('coral', 'pearl', 'star'):
        assert any(url.endswith(f'/region-{region}.webp') for url in cached), region
    original = saved(page)
    context.set_offline(True)
    page.reload(wait_until="load")
    page.locator('#board .gem').first.wait_for()
    restored = saved(page)
    assert {key: value for key, value in restored.items() if key != "updatedAt"} == {
        key: value for key, value in original.items() if key != "updatedAt"
    }
    assert page.evaluate("async()=>{const response=await fetch('./aquarium/art/jewels/level-30-4.webp');return response.ok&&(await response.arrayBuffer()).byteLength>100}")
    assert page.evaluate("async()=>{const response=await fetch('./aquarium/art/region-star.webp');return response.ok&&(await response.arrayBuffer()).byteLength>100}")
    tap_action(page, engine_hint(page, original["active"]["board"]))
    assert saved(page)["active"]["board"]["turnId"] == 1
    assert not errors, errors
    context.close()


if __name__ == '__main__':
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        small_controls = []
        for size in ((390, 844), (320, 640), (844, 390), (768, 1024), (1024, 768)):
            small_controls.extend(check_viewport(browser, *size))
        context, page, checkpoint, action, move_counts, terrain_replay = play_all_thirty(browser)
        post_win_errors = []
        page.on('pageerror', lambda error: post_win_errors.append(str(error)))
        interrupted_winning_turn(browser, checkpoint, action)
        pending_legacy_and_terrain(browser, checkpoint, action, terrain_replay)
        protected_reserve(browser, checkpoint, action)
        corrupt_save_recovery(browser, checkpoint)
        shop_and_import(page)
        upgrades_stories_and_postcard(page)
        assert not post_win_errors, post_win_errors
        context.close()
        if PRODUCTION:
            check_production_offline(browser)
        browser.close()
    assert not small_controls, f'Touch targets smaller than 48×48: {small_controls}'
    print(f'Five viewports, thirty touch-played wins ({move_counts} moves), three region gates, protected savings, pending/legacy replay, corrupt backup recovery, shop and import passed' +
          (', offline reload and turn passed.' if PRODUCTION else '.'))
