"""Phone UI regression checks for Livs magiske akvarie (30-level expansion).

Run with Vite on port 4173:
    python tests/aquarium_expansion_mobile.py

For a production preview, keep Vite available only as the fixture factory:
    AQ_BASE_URL=http://127.0.0.1:4174/LivsDyreOE/ python tests/aquarium_expansion_mobile.py

AQ_FIXTURE_URL overrides the development fixture server. Fixture imports create
and validate declared save checkpoints only. Every tested purchase, restoration,
story, selection, drag, refund and download goes through the target site's UI.
No production debug API, player save, or external service is used.
AQ_CASE selects one scenario; AQ_VIEWPORT=320x640 selects one phone size.
"""

import json
import os
import struct
import traceback
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("AQ_BASE_URL", "http://127.0.0.1:4173/LivsDyreOE/")
FIXTURE_URL = os.environ.get("AQ_FIXTURE_URL", "http://127.0.0.1:4173/LivsDyreOE/")
SAVE_KEY = "livs-akvarie.save.v1"
VIEWPORTS = [(390, 844), (320, 640), (844, 390)]
if os.environ.get("AQ_VIEWPORT"):
    VIEWPORTS = [tuple(map(int, os.environ["AQ_VIEWPORT"].split("x")))]


def saved(page):
    return json.loads(page.evaluate("key => localStorage.getItem(key)", SAVE_KEY))


def fixtures(browser):
    """Build legitimate engine boards in a separate, disposable origin context."""
    context = browser.new_context()
    page = context.new_page()
    page.route("**/qa-fixture-data", lambda route: route.fulfill(
        content_type="text/html", body="<!doctype html><title>QA fixture factory</title>"))
    page.goto(FIXTURE_URL.rstrip("/") + "/qa-fixture-data")
    result = page.evaluate("""async (base) => {
      const {freshSave,validateSave}=await import(base+'src/aquarium/save/store.ts');
      const {createBoard}=await import(base+'src/aquarium/core/index.ts');
      const make=(completed,stage,reserve,shells,allFish=false)=>{
        const save=freshSave();
        save.completed=Array.from({length:completed},(_,i)=>i+1);
        save.claimed=[...save.completed];save.shells=shells;
        save.active={board:createBoard(Math.max(1,completed)),pending:null,rewarded:false};
        save.settings={sound:false,hints:false,reducedMotion:true};
        Object.assign(save.adventure,{reefStage:stage,reefSavings:reserve,
          region:['sun','coral','pearl','star'][stage]});
        if(allFish)save.fishIds=['bobo','sky','glimt','plet'];
        if(!validateSave(save))throw Error('Invalid QA checkpoint');
        return save;
      };
      return {fresh:make(0,0,0,40),reserve:make(6,0,60,65),
        second:make(14,1,80,540),third:make(22,2,80,780),
        complete:make(29,3,0,800,true)};
    }""", FIXTURE_URL)
    context.close()
    return result


def phone(browser, size, checkpoint):
    width, height = size
    context = browser.new_context(
        viewport={"width": width, "height": height}, device_scale_factor=2,
        is_mobile=True, has_touch=True, accept_downloads=True,
    )
    context.add_init_script(
        f"if(!localStorage.getItem({json.dumps(SAVE_KEY)}))"
        f"localStorage.setItem({json.dumps(SAVE_KEY)},{json.dumps(json.dumps(checkpoint))});"
    )
    page = context.new_page()
    page.set_default_timeout(7000)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("response", lambda response: errors.append(f"HTTP {response.status}: {response.url}")
            if response.status >= 400 and "/aquarium/" in response.url else None)
    page.goto(BASE_URL, wait_until="networkidle")
    page.locator("#board .gem").first.wait_for()
    return context, page, errors


def tap(page, action, item=None, scope=None):
    selector = f'[data-action="{action}"]'
    if item is not None:
        selector += f'[data-id="{item}"]'
    (scope or page).locator(selector).first.tap()


def close_modal(page):
    if page.locator("#modal[open]").count():
        tap(page, "close-modal", scope=page.locator("#modal"))


def aquarium_mode(page):
    close_modal(page)
    if "aquarium-mode" not in (page.locator("body").get_attribute("class") or ""):
        page.locator("#aquarium-button").tap()


def play_mode(page):
    close_modal(page)
    if "aquarium-mode" in (page.locator("body").get_attribute("class") or ""):
        page.locator("#aquarium-button").tap()


def projects(page):
    close_modal(page)
    page.locator(".shell-wallet").tap()
    page.locator("#modal .reserve-note").tap()


def buy_decor(page, item, slot):
    close_modal(page)
    page.locator(".shell-wallet").tap()
    tap(page, "select-decor", item, scope=page.locator("#modal"))
    page.locator(f'.aq-slot[data-slot="{slot}"]').tap()


def fish_card(page, fish):
    aquarium_mode(page)
    page.locator("#levels-button").tap()
    tap(page, "fish-card", fish, scope=page.locator("#modal"))


def assert_fits(page):
    result = page.evaluate("""() => {
      const d=document.documentElement, modal=document.querySelector('#modal[open]');
      return {width:d.scrollWidth, viewport:innerWidth,
        height:d.scrollHeight, screen:innerHeight,
        modalOverflow:modal?modal.scrollWidth>modal.clientWidth+2:false,
        clippedControls:[...document.querySelectorAll('.game-toolbar button')]
          .filter(n=>n.getClientRects().length)
          .map(n=>({id:n.id,rect:n.getBoundingClientRect().toJSON()}))
          .filter(({rect:r})=>r.left < -1 || r.right > innerWidth+1 ||
            r.top < -1 || r.bottom > innerHeight+1)};
    }""")
    assert result["width"] <= result["viewport"] + 1, result
    assert result["height"] <= result["screen"] + 1, result
    assert not result["modalOverflow"], result
    assert not result["clippedControls"], result


def screenshot(page, label, size):
    page.screenshot(path=f"/tmp/akvarie-expansion-{label}-{size[0]}x{size[1]}.png", timeout=20000)


def drag(page, item, destination, cancel=False):
    """Use real browser touch events, not synthetic pointer handler calls."""
    box = page.locator(f'.aq-slot[data-decor="{item}"]').bounding_box()
    start = {"x": box["x"] + box["width"] / 2, "y": box["y"] + box["height"] / 2}
    end = {"x": page.viewport_size["width"] * destination[0],
           "y": page.viewport_size["height"] * destination[1]}
    session = page.context.new_cdp_session(page)
    session.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [start]})
    for step in range(1, 6):
        point = {axis: start[axis] + (end[axis] - start[axis]) * step / 5 for axis in ("x", "y")}
        session.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [point]})
        page.wait_for_timeout(20)
    assert page.locator(".aq-guides-visible").count() == 1, "Drag guides did not appear"
    assert page.locator(".aq-slot-dragging").count() == 1
    session.send("Input.dispatchTouchEvent", {"type": "touchCancel" if cancel else "touchEnd", "touchPoints": []})
    session.detach()
    assert page.locator(".aq-guides-visible").count() == 0


def newcomer(page, size):
    assert page.title() == "Livs magiske akvarie"
    assert "Livs magiske" in page.locator("h1").inner_text()
    assert "Bane 1 af 30" in page.locator("#level-badge").inner_text()
    assert_fits(page)
    screenshot(page, "first", size)
    page.locator("#levels-button").tap()
    cards = page.locator(".level-choice")
    assert cards.count() == 30
    assert cards.locator(":scope:not([disabled])").count() == 1
    shapes = cards.evaluate_all("nodes=>nodes.map(n=>[...n.querySelectorAll('.mini-board i')].map(c=>c.className).join(','))")
    assert len(set(shapes)) == 30, "Every level should have its own silhouette/terrain"
    assert_fits(page)
    close_modal(page)
    projects(page)
    assert page.locator('[data-action="restore-reef"]').first.is_disabled()
    assert "0 / 60" in page.locator(".project-amount").inner_text()
    assert_fits(page)
    close_modal(page)
    page.locator(".shell-wallet").tap()
    assert page.locator('[data-id="pearl-tree"]').is_disabled()
    assert page.locator('[data-id="moon-gate"]').is_disabled()
    close_modal(page)
    tap(page, "settings")
    page.locator('[data-setting="sound"]').check()
    assert saved(page)["settings"]["sound"] is True
    page.locator('[data-setting="sound"]').uncheck()
    assert saved(page)["settings"]["sound"] is False
    assert "Livs magiske akvarie" in page.locator("#modal").inner_text()
    assert_fits(page)


def reserve_and_gate(page, size):
    before = saved(page)
    buy_decor(page, "cave", 0)
    after = saved(page)
    assert after["shells"] == 65 and after["decorations"] == []
    assert after["adventure"]["reefSavings"] == 60
    assert "skaller" in page.locator("#toast").inner_text()
    projects(page)
    assert page.locator('[data-action="restore-reef"]').first.is_enabled()
    screenshot(page, "project-ready", size)
    tap(page, "restore-reef", scope=page.locator("#modal"))
    restored = saved(page)
    assert restored["shells"] == before["shells"] - 60
    assert restored["adventure"]["reefStage"] == 1
    assert restored["adventure"]["reefSavings"] == 0
    assert restored["adventure"]["region"] == "coral"
    assert page.locator(".aq-scene").get_attribute("data-reef") == "1"
    play_mode(page)
    page.locator("#levels-button").tap()
    assert page.locator('[data-action="choose-level"][data-id="7"]').is_enabled()
    assert page.locator('[data-action="choose-level"][data-id="8"]').is_disabled()
    assert_fits(page)
    page.reload(wait_until="networkidle")
    assert saved(page)["adventure"]["reefStage"] == 1
    assert saved(page)["shells"] == 5


def restore_later(page, size):
    before = saved(page)
    stage = before["adventure"]["reefStage"]
    projects(page)
    tap(page, "restore-reef", scope=page.locator("#modal"))
    assert saved(page)["adventure"]["reefStage"] == stage + 1
    assert saved(page)["shells"] == before["shells"] - 80
    assert saved(page)["adventure"]["reefSavings"] == 0
    assert page.locator(".aq-scene").get_attribute("data-reef") == str(stage + 1)
    screenshot(page, f"reef-{stage + 1}", size)
    assert_fits(page)


def decorating_and_stories(page, size):
    initial_wallet = saved(page)["shells"]
    buy_decor(page, "cave", 0)
    assert saved(page)["shells"] == initial_wallet - 20
    fish_card(page, "sky")
    tap(page, "fish-story", "sky", scope=page.locator("#modal"))
    assert saved(page)["adventure"]["stories"]["sky"] == 1
    assert page.locator('.aq-fish-sky.aq-fish-story').count() == 1
    for stage, cost in [(1, 40), (2, 70)]:
        wallet = saved(page)["shells"]
        page.locator('.aq-slot[data-decor="cave"]').tap()
        tap(page, "upgrade-preview", "cave")
        tap(page, "upgrade-decor", "cave", scope=page.locator("#modal"))
        assert saved(page)["shells"] == wallet - cost
        assert saved(page)["adventure"]["upgrades"]["cave"] == stage
        assert page.locator('.aq-slot[data-decor="cave"]').get_attribute("data-upgrade") == str(stage)
    fish_card(page, "sky")
    tap(page, "fish-story", "sky", scope=page.locator("#modal"))
    assert saved(page)["adventure"]["stories"]["sky"] == 2
    projects(page)
    tap(page, "choose-goal", "ring", scope=page.locator("#modal"))
    assert saved(page)["adventure"]["goal"] == "ring"
    tap(page, "goal-place", "ring", scope=page.locator("#modal"))
    page.locator('.aq-slot[data-slot="1"]').tap()
    assert "ring" in saved(page)["decorations"]
    before = saved(page)
    drag(page, "ring", (.68, .68))
    placed = next(p for p in saved(page)["placements"] if p["id"] == "ring")
    assert abs(placed["x"] - .68) < .001 and abs(placed["y"] - .68) < .001
    assert saved(page)["shells"] == before["shells"]
    tap(page, "undo-decor")
    assert saved(page)["placements"] == before["placements"]
    drag(page, "ring", (.7, .72), cancel=True)
    assert saved(page)["placements"] == before["placements"]
    assert page.locator('.aq-slot-dragging').count() == 0
    page.wait_for_timeout(360)
    drag(page, "ring", (.68, .68))
    persisted = saved(page)["placements"]
    page.reload(wait_until="networkidle")
    assert saved(page)["placements"] == persisted
    aquarium_mode(page)
    page.locator('.aq-slot[data-decor="cave"]').tap()
    tap(page, "sell-decor")
    assert "130 skaller" in page.locator("#modal").inner_text()
    tap(page, "confirm-sell", "cave", scope=page.locator("#modal"))
    after = saved(page)
    assert after["shells"] == initial_wallet - 20  # Only the ring remains purchased.
    assert "cave" not in after["decorations"] and "cave" not in after["adventure"]["upgrades"]
    assert "sky" in after["fishIds"] and after["adventure"]["stories"]["sky"] == 2
    assert_fits(page)
    screenshot(page, "decorating", size)


def light_regions_postcard(page, size):
    buy_decor(page, "pearl-tree", 8)
    buy_decor(page, "moon-gate", 9)
    assert saved(page)["shells"] == 560
    assert page.locator('.aq-slot[data-decor="pearl-tree"] .aq-decor-sprite').get_attribute("src").endswith("decor-pearl-tree.webp")
    tap(page, "ambience")
    for light in ("dawn", "moon", "day", "moon"):
        tap(page, "lighting", light, scope=page.locator("#modal"))
        assert saved(page)["adventure"]["lighting"] == light
        assert page.locator(".aq-scene").get_attribute("data-lighting") == light
    for region in ("sun", "coral", "pearl", "star"):
        if not page.locator("#modal[open]").count():
            tap(page, "ambience")
        tap(page, "view-region", region, scope=page.locator("#modal"))
        assert saved(page)["adventure"]["region"] == region
        assert page.locator(".aq-scene").get_attribute("data-region") == region
    page.wait_for_timeout(300)
    assert_fits(page)
    screenshot(page, "night-world", size)
    with page.expect_download(timeout=20000) as download_info:
        tap(page, "postcard")
    download = download_info.value
    assert download.suggested_filename.startswith("livs-magiske-akvarie-")
    path = Path(f"/tmp/livs-magiske-postcard-{size[0]}x{size[1]}.png")
    download.save_as(path)
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n" and len(data) > 100000
    width, height = struct.unpack(">II", data[16:24])
    assert max(width, height) <= 1600 and min(width, height) >= 300
    before = saved(page)
    page.reload(wait_until="networkidle")
    assert saved(page)["adventure"] == before["adventure"]


def remaining_fish_stories(page, size):
    for item, slot in [("arch", 2), ("bubbles", 5), ("ring", 1)]:
        buy_decor(page, item, slot)
    for fish in ("bobo", "plet"):
        for chapter in (1, 2):
            wallet = saved(page)["shells"]
            fish_card(page, fish)
            tap(page, "fish-story", fish, scope=page.locator("#modal"))
            assert saved(page)["adventure"]["stories"][fish] == chapter
            assert saved(page)["shells"] == wallet, "Story scenes never charge a care fee"
    fish_card(page, "glimt")
    tap(page, "fish-story", "glimt", scope=page.locator("#modal"))
    assert saved(page)["adventure"]["stories"]["glimt"] == 1
    page.locator('.aq-slot[data-decor="ring"]').tap()
    tap(page, "upgrade-preview", "ring")
    tap(page, "upgrade-decor", "ring", scope=page.locator("#modal"))
    assert saved(page)["adventure"]["upgrades"]["ring"] == 1
    fish_card(page, "glimt")
    tap(page, "fish-story", "glimt", scope=page.locator("#modal"))
    assert saved(page)["adventure"]["stories"]["glimt"] == 2
    fish_card(page, "glimt")
    assert page.locator('[data-action="fish-story"]').count() == 0
    assert "TO SMÅ EVENTYR · KLARET" in page.locator(".fish-story").inner_text()
    assert_fits(page)
    screenshot(page, "fish-stories", size)


def immovable_rock(page, board):
    pair = next((source, rock) for rock, fixed in enumerate(board["rocks"]) if fixed
                for source in (rock - 1, rock + 1, rock - 8, rock + 8)
                if 0 <= source < 64 and board["tiles"][source]
                and abs(source % 8 - rock % 8) + abs(source // 8 - rock // 8) == 1)
    box = page.locator("#board").bounding_box()
    points = [{"x": box["x"] + (cell % 8 + .5) * box["width"] / 8,
               "y": box["y"] + (cell // 8 + .5) * box["height"] / 8} for cell in pair]
    session = page.context.new_cdp_session(page)
    session.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [points[0]]})
    for i in range(1, 5):
        point = {axis: points[0][axis] + (points[1][axis] - points[0][axis]) * i / 4 for axis in ("x", "y")}
        session.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [point]})
    session.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    session.detach()
    page.wait_for_function("document.querySelector('#board').getAttribute('aria-busy')==='false'")
    assert saved(page)["active"]["board"] == board, "Dragging into an immovable rock must not change the board or charge a turn"


def live_motion(page, size):
    aquarium_mode(page)
    tap(page, "settings")
    page.locator('[data-setting="reducedMotion"]').uncheck()
    close_modal(page)
    assert page.locator(".aq-static").count() == 0
    assert page.locator(".aq-minnow-school i").count() == 7
    before = page.locator(".aq-fish").evaluate_all("nodes=>nodes.map(n=>n.style.transform)")
    page.wait_for_timeout(1100)  # Measure real motion, not a delayed UI action.
    after = page.locator(".aq-fish").evaluate_all("nodes=>nodes.map(n=>n.style.transform)")
    assert all(a != b for a, b in zip(before, after)), "Every owned fish should swim"
    assert page.locator(".aq-fish-tail").first.evaluate("n=>getComputedStyle(n).animationName") != "none"
    headings = page.evaluate("""() => new Promise(resolve => {
      const fish=[...document.querySelectorAll('.aq-fish')];
      const result=fish.map(n=>({id:n.dataset.fish,checked:0,backwards:0,
        tail:getComputedStyle(n.querySelector('.aq-fish-tail')).clipPath}));
      let last=fish.map(n=>{const r=n.getBoundingClientRect();return r.x+r.width/2});
      let frames=0;
      const sample=()=>{
        fish.forEach((n,i)=>{
          const r=n.getBoundingClientRect(),x=r.x+r.width/2,dx=x-last[i];
          // All four shipped illustrations face right. The displayed horizontal
          // flip must therefore have the same sign as actual travel, not its opposite.
          if(Math.abs(dx)>.03){
            result[i].checked++;
            if(Math.sign(dx)!==Number(n.style.getPropertyValue('--facing')))
              result[i].backwards++;
          }
          last[i]=x;
        });
        if(++frames<40)requestAnimationFrame(sample);else resolve(result);
      };
      requestAnimationFrame(sample);
    })""")
    for fish in headings:
        assert fish["checked"] > 0 and fish["backwards"] == 0, fish
        # Tail art is the LEFT portion of each right-facing original image.
        # Canonical CSS serialization is inset(top right bottom left).
        edges = fish["tail"].removeprefix("inset(").removesuffix(")").split()
        assert len(edges) == 4 and edges[3] == "0px", fish
        assert edges[1].endswith("%") and float(edges[1][:-1]) >= 50, fish
    screenshot(page, "living-fish", size)
    tap(page, "settings")
    page.locator('[data-setting="reducedMotion"]').check()
    close_modal(page)
    still = page.locator(".aq-fish").evaluate_all("nodes=>nodes.map(n=>n.style.transform)")
    page.wait_for_timeout(300)
    assert page.locator(".aq-fish").evaluate_all("nodes=>nodes.map(n=>n.style.transform)") == still
    assert page.locator(".aq-fish-tail").first.evaluate("n=>getComputedStyle(n).animationName") == "none"
    assert_fits(page)


def thirty_level_presentations(page, size):
    portraits, shapes = set(), set()
    for level in range(1, 31):
        play_mode(page)
        page.locator("#levels-button").tap()
        target = page.locator(f'[data-action="choose-level"][data-id="{level}"]')
        assert target.is_enabled(), level
        target.tap()
        if page.locator('[data-action="tutorial-done"]').count():
            tap(page, "tutorial-done", str(level))
        current = saved(page)["active"]["board"]
        assert current["levelId"] == level
        assert page.locator("body").get_attribute("data-gem-theme") == str(level - 1)
        shapes.add(tuple(current["voids"]))
        cell = next(i for i, tile in enumerate(current["tiles"]) if tile and tile["type"] == 0 and not tile.get("special"))
        portraits.add(page.locator(f'.gem[data-cell="{cell}"] img').get_attribute("src"))
        assert page.locator(".rock-cell").count() == sum(current["rocks"])
        assert page.locator(".void-cell").count() == sum(current["voids"])
        for objective in current["objectives"]:
            types = ["shell", "star", "drop", "leaf", "pearl"]
            if objective["kind"] not in types:
                continue
            tile_type = types.index(objective["kind"])
            normal = next(i for i, tile in enumerate(current["tiles"]) if tile and tile["type"] == tile_type and not tile.get("special"))
            expected = page.locator(f'.gem[data-cell="{normal}"] img').get_attribute("src")
            assert page.locator(f'.objective[data-kind="{objective["kind"]}"] img').get_attribute("src") == expected
        if level == 12:
            immovable_rock(page, current)
        assert_fits(page)
        if level in (7, 15, 23, 30):
            screenshot(page, f"level-{level}", size)
    assert len(shapes) == 30, len(shapes)
    assert len(portraits) == 30, len(portraits)


def main():
    failures = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"])
        checkpoints = fixtures(browser)
        cases = [("newcomer", "fresh", newcomer), ("reserve", "reserve", reserve_and_gate),
                 ("second", "second", restore_later), ("third", "third", restore_later),
                 ("decorating", "complete", decorating_and_stories),
                 ("stories", "complete", remaining_fish_stories),
                 ("postcard", "complete", light_regions_postcard),
                 ("motion", "complete", live_motion),
                 ("levels", "complete", thirty_level_presentations)]
        only = os.environ.get("AQ_CASE")
        for size in VIEWPORTS:
            for name, checkpoint, check in cases:
                if only and name != only:
                    continue
                context, page, errors = phone(browser, size, checkpoints[checkpoint])
                try:
                    check(page, size)
                    assert not errors, errors
                    print(f"PASS {size[0]}×{size[1]} {name}", flush=True)
                except Exception as error:
                    failures.append(f"{size[0]}×{size[1]} {name}: {error}")
                    try:
                        screenshot(page, f"FAILED-{name}", size)
                    except Exception as capture_error:
                        # Preserve the original UI failure if a busy renderer also
                        # refuses a diagnostic screenshot; never hide either one.
                        print(f"Diagnostic screenshot failed: {capture_error}", flush=True)
                    print(f"FAIL {failures[-1]}\n{traceback.format_exc()}", flush=True)
                finally:
                    context.close()
        browser.close()
    if failures:
        raise SystemExit("\n".join(failures))
    print("All expansion UI checks passed against " + BASE_URL, flush=True)


if __name__ == "__main__":
    main()
