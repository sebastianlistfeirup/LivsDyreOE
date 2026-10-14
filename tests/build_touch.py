"""Exercise the free-build loop with phone-style taps.

Run with a local Vite server: python tests/build_touch.py
Set LIVS_TEST_URL to check a production preview instead.
"""

import json
import os
import re

from playwright.sync_api import sync_playwright


URL = os.environ.get("LIVS_TEST_URL", "http://127.0.0.1:4173/LivsDyreOE/")
SAVE_KEY = "livs-dyreo.save.v1"


def state(page):
    return json.loads(page.evaluate("key => localStorage.getItem(key)", SAVE_KEY))


def tap_free_cell(page, canvas, excluded=None):
    bounds = canvas.bounding_box()
    assert bounds, "The island canvas was not visible"
    for yf in (0.32, 0.42, 0.52):
        for xf in (0.25, 0.4, 0.55, 0.7):
            point = (round(bounds["x"] + bounds["width"] * xf), round(bounds["y"] + bounds["height"] * yf))
            if point == excluded:
                continue
            page.touchscreen.tap(*point)
            confirm = page.locator('#preview-bar [data-action="confirm-preview"]')
            if confirm.count() and confirm.is_enabled():
                return point
    raise AssertionError("No valid, tappable build position was found on the mobile island")


def check_phone(browser, width, height):
    context = browser.new_context(
        viewport={"width": width, "height": height},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
    )
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(URL, wait_until="networkidle")
    canvas = page.locator(".park-canvas canvas")
    canvas.wait_for()

    page.locator('.tabbar [data-value="build"]').tap()
    page.locator('[data-action="tool"][data-value="shrub"]').tap()
    assert "Buskbed" in page.locator(".build-status").inner_text()
    original_tap = tap_free_cell(page, canvas)
    preview = page.locator("#preview-bar")
    assert "Buskbed" in preview.inner_text()
    bounds = preview.bounding_box()
    assert bounds and bounds["x"] >= 0 and bounds["x"] + bounds["width"] <= width + 1
    page.screenshot(path=f"/tmp/livs-build-preview-{width}.png", full_page=True)
    preview.locator('[data-action="confirm-preview"]').tap()
    built = state(page)
    assert built["budget"] == 1240, built["budget"]
    assert len(built["placedObjects"]) == 1, built["placedObjects"]
    original_cell = built["placedObjects"][0]["gridPosition"]

    page.locator('[data-action="tool"][data-value="move"]').tap()
    page.touchscreen.tap(*original_tap)
    assert "Tryk" in page.locator(".build-status").inner_text()
    target = tap_free_cell(page, canvas, excluded=original_tap)
    assert target != original_tap
    assert "Gratis flytning" in preview.inner_text()
    preview.locator('[data-action="confirm-preview"]').tap()
    moved = state(page)
    assert moved["budget"] == 1240
    assert moved["placedObjects"][0]["gridPosition"] != original_cell

    page.locator('.build-status [data-action="undo"]').tap()
    restored = state(page)
    assert restored["placedObjects"][0]["gridPosition"] == original_cell
    page.locator('.build-status [data-action="undo"]').tap()
    empty = state(page)
    assert empty["budget"] == 1250 and empty["placedObjects"] == []
    assert not errors, errors
    context.close()


def check_pinch(browser):
    context = browser.new_context(
        viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True
    )
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(URL, wait_until="networkidle")
    page.locator('.tabbar [data-value="build"]').tap()
    page.locator('[data-action="tool"][data-value="shrub"]').tap()
    canvas = page.locator(".park-canvas canvas")
    bounds = canvas.bounding_box()
    assert bounds
    tap_x, tap_y = bounds["x"] + 150, bounds["y"] + 130
    page.touchscreen.tap(tap_x, tap_y)
    before = re.search(r"Felt \d+, \d+", page.locator("#preview-bar").inner_text())
    assert before

    center_x = bounds["x"] + bounds["width"] / 2
    center_y = bounds["y"] + bounds["height"] / 2
    session = context.new_cdp_session(page)

    def finger(offset, pointer_id):
        return {"x": center_x + offset, "y": center_y, "id": pointer_id}

    session.send("Input.dispatchTouchEvent", {
        "type": "touchStart", "touchPoints": [finger(-40, 1), finger(40, 2)]
    })
    session.send("Input.dispatchTouchEvent", {
        "type": "touchMove", "touchPoints": [finger(-110, 1), finger(110, 2)]
    })
    session.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    page.touchscreen.tap(tap_x, tap_y)
    after = re.search(r"Felt \d+, \d+", page.locator("#preview-bar").inner_text())
    assert after and after.group() != before.group(), (before.group(), after.group() if after else None)
    assert not page.evaluate("key => localStorage.getItem(key)", SAVE_KEY)
    assert not errors, errors
    context.close()


if __name__ == "__main__":
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"])
        for phone in ((390, 844), (320, 640)):
            check_phone(browser, *phone)
        check_pinch(browser)
        browser.close()
    print("Phone build, move, undo, and two-finger zoom passed.")
