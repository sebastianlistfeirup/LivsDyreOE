"""Run against a local Vite server: python tests/browser_smoke.py."""

from pathlib import Path
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:4173/LivsDyreOE/"


def check_layout(browser, width, height):
    page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(URL, wait_until="networkidle")
    page.locator(".park-canvas canvas").wait_for()
    if width == 320:
        manifest = page.request.get(f"{URL}manifest.webmanifest")
        assert manifest.ok and manifest.json()["start_url"] == "/LivsDyreOE/"
    page.screenshot(path=f"/tmp/livs-{width}x{height}.png", full_page=True)
    sizes = page.evaluate(
        "({body: document.body.scrollWidth, viewport: innerWidth, canvas: document.querySelector('.park-canvas canvas').getBoundingClientRect().width})"
    )
    assert sizes["body"] <= sizes["viewport"] + 1, (width, height, sizes)
    assert sizes["canvas"] > 100, (width, height, sizes)
    controls = page.locator(".world-bottom button").evaluate_all(
        "nodes => nodes.map(node => ({width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height}))"
    )
    assert all(control["width"] >= 48 and control["height"] >= 48 for control in controls), (width, height, controls)
    assert not errors, (width, height, errors)
    page.close()


def play_first_rescue(browser):
    page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(URL, wait_until="networkidle")
    page.locator('.tabbar [data-value="build"]').click()
    page.locator('[data-action="standard"][data-value="capybara"]').click()
    assert "980 Budget" in page.locator("#budget").inner_text()
    assert "Gyldigt hjem" in page.locator("#side-panel").inner_text()
    page.locator('.tabbar [data-value="park"]').click()
    page.locator('[data-action="advance"]').click()
    page.locator('.tabbar [data-value="missions"]').click()
    page.locator('[data-action="start-mission"][data-value="capybara"]').click()
    assert "Sporjagt" in page.locator(".mission-intro").inner_text()
    for clue in ("foot", "reed", "fur"):
        page.locator(f'[data-mini="clue"][data-value="{clue}"]').click()
    for clue in ("foot", "reed", "fur"):
        page.locator(f'[data-mini="route"][data-value="{clue}"]').click()
    assert "Pump vandet væk" in page.locator(".mission-intro").inner_text()
    for _ in range(5):
        page.locator('[data-mini="help"]').click()
    page.locator('[data-mini="test"]').click()
    assert "Redningsbåden" in page.locator(".mission-intro").inner_text()
    for waypoint in range(4):
        page.locator(f'[data-mini="waypoint"][data-value="{waypoint}"]').click()
    assert "Pak redningsbåden" in page.locator(".mission-intro").inner_text()
    for name, cell in (("a", "0,0"), ("b", "3,0"), ("med", "1,2"), ("gear", "3,2")):
        page.locator(f'[data-mini="select"][data-value="{name}"]').click()
        page.locator(f'[data-mini="place"][data-value="{cell}"]').click()
    page.locator('[data-mini="test"]').click()
    assert "Dyreklinikken" in page.locator(".mission-intro").inner_text()
    for area in range(3):
        page.locator(f'[data-mini="clean"][data-value="{area}"]').click()
    page.locator('[data-mini="dry"]').click()
    for zone in range(3):
        page.locator(f'[data-mini="scan"][data-value="{zone}"]').click()
    page.locator('[data-mini="badge"]').click()
    assert "2/6 dyr" in page.locator("#animal-count").inner_text()
    assert "1.220 Budget" in page.locator("#budget").inner_text()
    page.reload(wait_until="networkidle")
    assert "2/6 dyr" in page.locator("#animal-count").inner_text()
    assert "1.220 Budget" in page.locator("#budget").inner_text()
    assert not errors, errors
    page.screenshot(path="/tmp/livs-first-rescue.png", full_page=True)

    page.locator('[data-action="advance"]').click()  # chapter 3
    page.locator('[data-action="suggest-sign"]').click()
    page.locator('[data-action="confirm-preview"]').click()
    page.locator('.tabbar [data-value="park"]').click()
    page.locator('[data-action="advance"]').click()  # chapter 4
    page.locator('.tabbar [data-value="build"]').click()
    page.locator('[data-action="standard"][data-value="tiger"]').click()
    page.locator('.tabbar [data-value="missions"]').click()
    page.locator('[data-action="start-mission"][data-value="tiger"]').click()
    assert "Byg gangbroen" in page.locator(".mission-intro").inner_text()
    page.locator('[data-mini="select"][data-value="2"]').click()
    page.locator('[data-mini="rotate"]').click()
    page.locator('[data-mini="place"][data-value="0"]').click()
    page.locator('[data-mini="solve"]').click()
    assert "Lok og led" in page.locator(".mission-intro").inner_text()
    page.locator('[data-mini="point"][data-value="1"]').click()
    page.locator('[data-mini="gate"][data-value="1"]').click()
    page.locator('[data-mini="test"]').click()
    page.locator('[data-mini="point"][data-value="2"]').click()
    page.locator('[data-mini="gate"][data-value="2"]').click()
    page.locator('[data-mini="test"]').click()
    page.locator('[data-mini="solve"]').click()  # cargo replay
    page.locator('[data-mini="solve"]').click()  # clinic replay
    assert "4/6 dyr" in page.locator("#animal-count").inner_text()

    page.locator('[data-action="advance"]').click()  # chapter 5
    page.locator('[data-action="tab"][data-value="settings"]').first.click()
    page.locator('#park-name-input').fill('Eventyrøen')
    page.locator('[data-action="rename-park"]').click()
    page.locator('.tabbar [data-value="park"]').click()
    page.locator('[data-action="advance"]').click()  # chapter 6
    page.locator('.tabbar [data-value="build"]').click()
    page.locator('[data-action="standard"][data-value="penguin"]').click()
    page.locator('.tabbar [data-value="missions"]').click()
    page.locator('[data-action="start-mission"][data-value="penguin"]').click()
    page.locator('[data-mini="solve"]').click()  # boat
    assert "Fri af nettet" in page.locator(".mission-intro").inner_text()
    for rope in range(3):
        for knot in range(3):
            page.locator(f'[data-mini="knot"][data-value="{rope},{knot}"]').click()
    page.locator('[data-mini="solve"]').click()  # cargo
    page.locator('[data-mini="solve"]').click()  # clinic
    assert "6/6 dyr" in page.locator("#animal-count").inner_text()

    page.locator('[data-action="advance"]').click()  # chapter 7
    page.locator('[data-action="service"]').click()
    page.locator('[data-mini="solve"]').click()
    page.locator('[data-action="advance"]').click()  # chapter 8
    page.locator('[data-action="suggest-remodel"]').click()
    page.locator('[data-action="confirm-preview"]').click()
    page.locator('.tabbar [data-value="park"]').click()
    page.locator('[data-action="photo"]').click()
    page.locator('[data-action="advance"]').click()  # chapter 9
    page.locator('[data-action="suggest-portal"]').click()
    page.locator('[data-action="confirm-preview"]').click()
    page.locator('.tabbar [data-value="park"]').click()
    page.locator('[data-action="advance"]').click()  # chapter 10
    for species in ("capybara", "tiger", "penguin"):
        page.locator(f'.world-bottom [data-action="focus"][data-value="{species}"]').click()
    page.locator('[data-action="final-photo"]').click()
    page.locator('[data-action="advance"]').click()
    assert "Parken er åben" in page.locator("#chapter-label").inner_text()
    assert page.locator("#celebration.playing i").count() == 30
    assert "width:100%" in page.locator(".chapter-progress .progress-track span").get_attribute("style")
    page.reload(wait_until="networkidle")
    assert "6/6 dyr" in page.locator("#animal-count").inner_text()
    assert "Parken er åben" in page.locator("#chapter-label").inner_text()
    assert not errors, errors
    page.screenshot(path="/tmp/livs-party.png", full_page=True)
    page.locator('.tabbar [data-value="album"]').click()
    final_photo = page.locator('img[alt^="Foto af"]').last
    assert final_photo.get_attribute("src").startswith("data:image/jpeg;base64,")
    assert final_photo.evaluate("img => img.complete && img.naturalWidth > 0")
    page.screenshot(path="/tmp/livs-album.png", full_page=True)
    page.close()


if __name__ == "__main__":
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"])
        for viewport in ((320, 640), (390, 844), (844, 390), (768, 1024), (1024, 768)):
            check_layout(browser, *viewport)
        play_first_rescue(browser)
        browser.close()
    print("5 viewport checks, all three rescues, and all 10 chapters passed; screenshots are in /tmp.")
