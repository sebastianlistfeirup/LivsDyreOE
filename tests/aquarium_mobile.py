"""Touch/browser QA for Livs akvarie against a local Vite server.

Run: python tests/aquarium_mobile.py
Set LIVS_TEST_URL to override http://127.0.0.1:4173/LivsDyreOE/.
Set LIVS_TEST_PRODUCTION=1 for a built site; fixed winning actions then replace
the development-only engine import. Every action still uses browser controls.
"""

import json
import os

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, sync_playwright


URL = os.environ.get("LIVS_TEST_URL", "http://127.0.0.1:4173/LivsDyreOE/")
SAVE_KEY = "livs-akvarie.save.v1"
ENGINE_URL = "/LivsDyreOE/src/aquarium/core/index.ts"
PRODUCTION = os.environ.get("LIVS_TEST_PRODUCTION") == "1"
# Captured from the deterministic, shipped level seeds using the same hint
# policy as the development browser run. A production build exposes no TS
# source or debug hooks; this fixture exercises its public touch UI only.
WINNING_SWAPS = (
    ((42, 43), (58, 59), (52, 60), (0, 8)),
    ((35, 36), (35, 43), (36, 44), (38, 39), (35, 43), (32, 40)),
    ((43, 51), (11, 19), (27, 35), (34, 42), (27, 28), (7, 15)),
    ((52, 60), (38, 39), (55, 63), (53, 54), (50, 51)),
    ((42, 43), (45, 46), (22, 30)),
    ((57, 58), (56, 57), (10, 18), (45, 46), (53, 54), (2, 3), (8, 16), (62, 63)),
    ((3, 4), (1, 9), (18, 19), (34, 35), (41, 49), (51, 59)),
    ((35, 43), (51, 59), (61, 62)),
    ((13, 21), (20, 28), (52, 60), (11, 19), (19, 27), (42, 50), (36, 44),
     (3, 4), (3, 11), (5, 6), (21, 29), (3, 11), (1, 9), (17, 25), (17, 25)),
    ((40, 41), (54, 55), (16, 24), (28, 29), (33, 41), (42, 43), (37, 45),
     (53, 54), (53, 61), (58, 59)),
)


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
            document.querySelector('#board')?.getAttribute('aria-busy') === 'false';
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
        swaps = WINNING_SWAPS[board["levelId"] - 1]
        assert board["turnId"] < len(swaps), (board["levelId"], board["turnId"])
        from_cell, to_cell = swaps[board["turnId"]]
        return {"kind": "swap", "from": from_cell, "to": to_cell}
    return page.evaluate(
        """async ({board,url}) => {
          const engine = await import(url);
          return engine.getHint(board);
        }""",
        {"board": board, "url": ENGINE_URL},
    )


def tap_action(page, action):
    before = saved(page)["active"]["board"]["turnId"]
    if action["kind"] == "swap":
        page.locator(f'.gem[data-cell="{action["from"]}"]').tap()
        page.locator(f'.gem[data-cell="{action["to"]}"]').tap()
    else:
        page.locator(f'.gem[data-cell="{action["cell"]}"]').tap()
        page.locator('[data-action="use-special"]').tap()
    try:
        wait_settled(page, before)
    except PlaywrightTimeoutError as error:
        raise AssertionError(f"Turn did not settle: action={action}, before={before}, after={saved(page)['active']}, board_busy={page.locator('#board').get_attribute('aria-busy')}") from error


def mobile_page(browser, width=390, height=844):
    context = browser.new_context(
        viewport={"width": width, "height": height},
        device_scale_factor=2, is_mobile=True, has_touch=True,
        accept_downloads=True,
    )
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(URL, wait_until="networkidle")
    page.locator('#board .gem').first.wait_for()
    page.wait_for_function("() => document.querySelectorAll('#board .gem').length >= 56")
    return context, page, errors


def set_reduced_motion(page):
    page.locator('[data-action="settings"]').tap()
    page.locator('[data-setting="reducedMotion"]').check()
    page.locator('[data-action="close-modal"]').tap()
    assert saved(page)["settings"]["reducedMotion"] is True


def play_all_ten(browser):
    context, page, errors = mobile_page(browser)
    assert saved(page)["shells"] == 40
    page.screenshot(path="/tmp/livs-akvarie-first-phone.png", full_page=True)
    set_reduced_motion(page)
    winning_checkpoint = None
    winning_action = None
    move_counts = []
    for level in range(1, 11):
        print(f'Touch-playing level {level}', flush=True)
        assert saved(page)["active"]["board"]["levelId"] == level
        theme = ('Solbugten', 'Koralhaven', 'Perlelagunen', 'Krystalrevet', 'Stjernedybet')[(level - 1) // 2]
        assert theme in page.locator('#level-badge').inner_text()
        assert page.locator('body').get_attribute('data-gem-theme') == str((level - 1) // 2)
        # The objective preview must match the actual jewel, including its new theme.
        opening_board = saved(page)["active"]["board"]
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
            if level == 1 and saved(page)["active"]["rewarded"]:
                winning_checkpoint = before
                winning_action = action
            assert moves <= 28, (level, moves)
        move_counts.append(moves)
        current = saved(page)
        assert current["shells"] == 40 + level * 40, (level, current["shells"])
        assert current["claimed"] == list(range(1, level + 1))
        assert current["completed"] == current["claimed"]
        assert page.locator('#modal').is_visible()
        if level == 1:
            page.reload(wait_until="networkidle")
            assert saved(page)["shells"] == 80
            assert saved(page)["claimed"] == [1]
        if level < 10:
            if page.locator('[data-action="next-level"]').count():
                page.locator('[data-action="next-level"]').tap()
            else:
                page.locator('[data-action="levels"]').tap()
                page.locator(f'[data-action="choose-level"][data-id="{level + 1}"]').tap()
            page.wait_for_function(
                "({key,id}) => JSON.parse(localStorage.getItem(key)).active.board.levelId === id",
                arg={"key": SAVE_KEY, "id": level + 1},
            )
    assert saved(page)["shells"] == 440
    assert saved(page)["completed"] == list(range(1, 11))
    fresh_tab = context.new_page()
    fresh_tab.goto(URL, wait_until="networkidle")
    assert saved(fresh_tab)["shells"] == 440
    assert saved(fresh_tab)["completed"] == list(range(1, 11))
    fresh_tab.close()
    page.screenshot(path="/tmp/livs-akvarie-ten-wins.png", full_page=True)
    assert not errors, errors
    assert winning_checkpoint and winning_action
    return context, page, winning_checkpoint, winning_action, move_counts


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
    interrupted.reload(wait_until="networkidle")
    assert saved(interrupted)["shells"] == 80
    assert saved(interrupted)["claimed"] == [1]
    assert not normal_errors and not interrupted_errors, (normal_errors, interrupted_errors)
    normal_context.close()
    interrupted_context.close()


def shop_and_import(page):
    page.locator('[data-action="win-decorate"]').tap()
    page.locator('[data-action="select-decor"][data-id="seagrass"]').tap()
    page.locator('.aq-slot[data-slot="0"]').tap()
    assert saved(page)["shells"] == 425
    assert saved(page)["placements"] == [{"id": "seagrass", "slot": 0, "rotation": 0}]

    page.locator('.aq-slot[data-slot="0"]').tap()
    page.locator('.aq-slot[data-slot="1"]').tap()
    assert saved(page)["shells"] == 425
    assert saved(page)["placements"][0]["slot"] == 1
    page.locator('[data-action="undo-decor"]').tap()
    assert saved(page)["placements"][0]["slot"] == 0

    page.locator('.aq-slot[data-slot="0"]').tap()
    page.locator('[data-action="rotate-decor"]').tap()
    assert saved(page)["placements"][0]["rotation"] == 1
    page.locator('[data-action="sell-decor"]').tap()
    page.locator('[data-action="confirm-sell"]').tap()
    assert saved(page)["shells"] == 440
    assert saved(page)["decorations"] == []

    page.locator('[data-action="levels"]').tap()  # Fish catalogue in aquarium mode.
    page.locator('[data-action="fish-card"][data-id="sky"]').tap()
    page.locator('[data-action="buy-fish"][data-id="sky"]').tap()
    assert saved(page)["shells"] == 400
    assert 'sky' in saved(page)["fishIds"]

    page.locator('[data-action="settings"]').tap()
    with page.expect_download() as transfer:
        page.locator('[data-action="export"]').tap()
    download = transfer.value
    exported = json.loads(open(download.path(), encoding="utf-8").read())
    assert exported["shells"] == 400
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
    assert saved(page)["shells"] == 400
    assert 'sky' in saved(page)["fishIds"]


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
    original = saved(page)
    context.set_offline(True)
    page.reload(wait_until="load")
    page.locator('#board .gem').first.wait_for()
    restored = saved(page)
    assert {key: value for key, value in restored.items() if key != "updatedAt"} == {
        key: value for key, value in original.items() if key != "updatedAt"
    }
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
        context, page, checkpoint, action, move_counts = play_all_ten(browser)
        interrupted_winning_turn(browser, checkpoint, action)
        shop_and_import(page)
        context.close()
        if PRODUCTION:
            check_production_offline(browser)
        browser.close()
    assert not small_controls, f'Touch targets smaller than 48×48: {small_controls}'
    print(f'Five viewports, ten touch-played wins ({move_counts} moves), pending replay, shop and import passed' +
          (', offline reload and turn passed.' if PRODUCTION else '.'))
