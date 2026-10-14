"""Real touch drags + animated power-up smoke checks (local development server).

Run with Python Playwright and /usr/bin/chromium available:
  python tests/aquarium_gestures.py
Only isolated browser contexts receive the labelled visual fixtures below.
No production debug API or player save is modified.
"""

import json
from playwright.sync_api import sync_playwright
from aquarium_mobile import ENGINE_URL, SAVE_KEY, mobile_page, saved, wait_settled


def center(page, cell):
    box = page.locator(f'.gem[data-cell="{cell}"]').bounding_box()
    return {"x": box["x"] + box["width"] / 2, "y": box["y"] + box["height"] / 2}


def swipe(page, session, action, cancel=False):
    start, end = center(page, action["from"]), center(page, action["to"])
    node = page.locator(f'.gem[data-cell="{action["from"]}"]')
    tile_id = node.get_attribute('data-tile-id')
    original = node.bounding_box()
    session.send('Input.dispatchTouchEvent', {"type": "touchStart", "touchPoints": [start]})
    for i in range(1, 6):
        point = {axis: start[axis] + (end[axis] - start[axis]) * i / 5 for axis in ("x", "y")}
        session.send('Input.dispatchTouchEvent', {"type": "touchMove", "touchPoints": [point]})
        page.wait_for_timeout(18)
    held = page.locator(f'.gem[data-tile-id="{tile_id}"]').bounding_box()
    assert abs((held['x'] - original['x']) - (end['x'] - start['x'])) < 1
    assert abs((held['y'] - original['y']) - (end['y'] - start['y'])) < 1
    assert page.locator('.gem.drag-neighbour').count() == 1, 'The adjacent jewel should react to the finger before release'
    session.send('Input.dispatchTouchEvent', {"type": "touchCancel" if cancel else "touchEnd", "touchPoints": []})


def gestures(browser):
    context, page, errors = mobile_page(browser)
    session = context.new_cdp_session(page)
    before = saved(page)['active']['board']
    action = page.evaluate("async ({url,board}) => (await import(url)).getHint(board)", {"url": ENGINE_URL, "board": before})
    expected = page.evaluate("async ({url,board,action}) => (await import(url)).playTurn(board,action).state", {"url": ENGINE_URL, "board": before, "action": action})
    swipe(page, session, action)
    wait_settled(page, before['turnId'])
    assert saved(page)['active']['board'] == expected
    before = saved(page)['active']['board']
    invalid = page.evaluate("""async ({url,board}) => {
      const {playTurn} = await import(url);
      for(let from=0;from<64;from++) for(const to of [from+1,from+8]) {
        if(to>=64 || (to===from+1 && from%8===7) || !board.tiles[from] || !board.tiles[to]) continue;
        const action={kind:'swap',from,to};
        if(!playTurn(board,action).valid) return action;
      }
    }""", {"url": ENGINE_URL, "board": before})
    assert invalid
    swipe(page, session, invalid)
    page.wait_for_function("() => document.querySelector('#board').getAttribute('aria-busy') === 'false'")
    assert saved(page)['active']['board'] == before, 'Invalid drag must not charge a move'
    swipe(page, session, invalid, cancel=True)
    page.wait_for_timeout(100)
    assert saved(page)['active']['board'] == before, 'Cancelled drag must not charge a move'
    assert page.locator('.gem.held').count() == 0
    assert page.locator('.gem.drag-neighbour').count() == 0
    assert not errors, errors
    context.close()
    print('Touch: finger following, neighbour reaction, valid swap, invalid rollback and touch cancellation PASS', flush=True)


def combo_effects(browser):
    context, page, errors = mobile_page(browser)
    for pair, kind, count in ((('row', 'row'), 'cross', 15), (('bomb', 'row'), 'cross-blast', 39), (('color', 'color'), 'rainbow', 64)):
        page.evaluate('''async ({url,key,pair})=>{
          const {createBoard}=await import(url);const save=JSON.parse(localStorage.getItem(key));
          const board=createBoard(1);board.tiles=board.tiles.map((_,i)=>({id:i+1,type:(Math.floor(i/8)*2+i%8)%5}));board.nextId=65;
          board.tiles[27].special=pair[0];board.tiles[28].special=pair[1];
          save.active={board,pending:null,rewarded:false};save.settings.reducedMotion=false;
          localStorage.setItem(key,JSON.stringify(save));
        }''', {'url': ENGINE_URL, 'key': SAVE_KEY, 'pair': pair})
        page.reload(wait_until='networkidle')
        before = saved(page)['active']['board']
        expected = page.evaluate('async({url,board})=>(await import(url)).playTurn(board,{kind:"swap",from:27,to:28})', {'url': ENGINE_URL, 'board': before})
        page.locator('.gem[data-cell="27"]').tap()
        page.locator('.gem[data-cell="28"]').tap()
        footprint = page.locator(f'.combo-footprint[data-combo="{kind}"]')
        footprint.wait_for(state='attached')
        actual = footprint.locator(':scope>i').evaluate_all('(nodes)=>nodes.map(n=>Number(n.dataset.cell))')
        target = next(event['combo']['cells'] for event in expected['events'] if event.get('combo'))
        assert actual == target and len(actual) == count, (kind, actual, target)
        page.wait_for_timeout(90)
        page.screenshot(path=f'/tmp/livs-magiske-akvarie-combo-{kind}.png')
        wait_settled(page, 0)
        assert saved(page)['active']['board'] == expected['state']
        assert saved(page)['active']['board']['movesRemaining'] == 17
        print(f'{kind}: exact {count}-cell footprint, visible touch activation, settled identities PASS', flush=True)
    assert not errors, errors
    context.close()


def effects(browser):
    context, page, errors = mobile_page(browser)
    for special in ('row', 'column', 'bomb', 'color'):
        # A declared test fixture makes each normally earned power-up visible.
        # The effect itself is triggered solely through the same touch controls.
        page.evaluate("""async ({url,key,special}) => {
          const {createBoard}=await import(url);
          const save=JSON.parse(localStorage.getItem(key));
          save.active={board:createBoard(10),pending:null,rewarded:false};
          save.active.board.tiles[27].special=special;
          save.settings.reducedMotion=false;
          save.fishIds=['bobo','sky','glimt','plet'];
          localStorage.setItem(key,JSON.stringify(save));
        }""", {"url": ENGINE_URL, "key": SAVE_KEY, "special": special})
        page.reload(wait_until='networkidle')
        page.locator('.gem[data-cell="27"]').tap()
        if special == 'color':
            page.locator('.gem[data-cell="28"]').tap()
        else:
            page.locator('[data-action="use-special"]').tap()
        page.wait_for_selector(f'.special-wave.{special}', state='attached')
        page.wait_for_timeout(70)
        particles = page.locator('.board-effects').evaluate("canvas => { const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data; let lit=0; for(let i=3;i<pixels.length;i+=4) if(pixels[i]>20) lit++; return lit; }")
        assert particles > 100, (special, particles)
        page.screenshot(path=f'/tmp/livs-akvarie-effect-{special}.png')
        wait_settled(page, 0)
        assert saved(page)['active']['board']['movesRemaining'] == 27
        print(f'{special}: visible animated particles={particles}, settled with one move PASS', flush=True)
    assert not errors, errors
    context.close()


if __name__ == '__main__':
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        gestures(browser)
        effects(browser)
        combo_effects(browser)
        browser.close()
