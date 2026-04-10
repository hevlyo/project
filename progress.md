Original prompt: PLEASE IMPLEMENT THIS PLAN:
# Upgrade Pega Bola 3000 into a polished, sharper prototype

## Summary
- Keep the current stack; do not do a Vite/TypeScript rewrite in this pass.
- Prioritize first-play experience, visual coherence, and a reliable multiplayer loop.
- Reduce scope to one solid mode: join, move, collect, grow, leaderboard.
- Cut or disable unfinished systems in this pass instead of shipping half-wired features.

## Key Changes
- Unify the boot flow across [public/index.html](/home/hevlyo/pegabola3000/public/index.html) and [public/js/main.js](/home/hevlyo/pegabola3000/public/js/main.js): load one client app script, keep menu/start state inside JS, remove dynamic script injection, and ensure `animate()` runs exactly once.
- Incrementally split the client into clear responsibilities while staying in vanilla JS: bootstrap/menu state, scene/rendering, socket sync, HUD/messages, and local gameplay helpers.
- Move authoritative match state into [src/models/GameState.js](/home/hevlyo/pegabola3000/src/models/GameState.js); keep the socket layer focused on transport and event broadcasting.
- Remove dead runtime references from the shipping path: no active weather, zone, or ability code unless both client and server support it fully.
- Rework presentation around the current chaotic PT-BR tone: stronger title screen, better nickname flow, clear connection states, cleaner HUD, sharper leaderboard, and visible pickup feedback.
- Keep the third-person chase camera, but make it stable: one camera update path, smoother follow behavior, sane spawn framing, and correct resize/fullscreen handling.
- Polish the arena visually in-scene rather than in DOM-heavy overlays: cleaner lighting, more intentional ground/background treatment, readable materials, and subtle collection feedback.
- Stay desktop-first with basic responsive support for smaller laptop windows; add `f` fullscreen toggle and `Esc` exit.

## Interfaces
- Add `window.render_game_to_text(): string` and `window.advanceTime(ms): void` for deterministic testing.
- `render_game_to_text` should include only current playable state: mode, connection state, local player position/size/score, visible balls, player count, top 3 leaderboard, and coordinate note.
- Limit the supported socket contract in this pass to the existing core loop: `joinGame`, `playerMovement`, and `collectBall` from client; keep only the matching server events already used by the prototype.
- Remove unsupported emits and handlers instead of leaving dormant API surface.

## Test Plan
- Install dependencies from the existing lockfile, start the server, and verify a clean boot with zero console errors.
- Smoke flow: open menu, enter nickname, start once, confirm one connection and one local player, move with WASD, collect a ball, and verify score, size, and leaderboard updates.
- Recovery flow: force disconnect/reconnect and confirm no duplicate HUD, duplicate player, or duplicate `joinGame`.
- Presentation checks: menu and HUD remain legible at common desktop sizes; fullscreen preserves rendering and input mapping; missing audio never blocks play.
- Automation checks: run the `develop-web-game` Playwright client against the local server, inspect gameplay screenshots, compare them with `render_game_to_text`, and fix the first new console error before continuing.
- Regression checks: no undefined helper calls remain, and no duplicate boot or socket-connect paths fire.

## Assumptions
- This pass stays on Express, Socket.IO, and browser-loaded Three.js.
- The target is a polished desktop prototype, not a mobile release and not a feature-heavy arcade expansion.
- PT-BR copy and the irreverent tone stay, but the presentation becomes more intentional and less sloppy.
- Any system not fully wired on both client and server is deferred from the playable build.
- Implementation should create and maintain `progress.md` during the work for handoff and test-loop continuity.

Notes:
- Dirty worktree detected before edits: `src/config/gameConfig.js`, `src/socket/socketManager.js`, deleted `package-lock.json`, untracked `bun.lock`.
- Initial audit found duplicated boot flow, duplicate `connect` handlers, duplicate `animate()` entrypoints, and client-side references to unsupported abilities/weather/zones.

Progress updates:
- Added `src/models/GameState.js` and moved authoritative world/player/ball state there.
- Simplified `src/socket/socketManager.js` to transport-only event handling over the existing core socket contract.
- Removed the self-referential `pega-bola: "file:"` dependency from `package.json`.
- Replaced the old dynamic boot flow with a static HTML shell plus browser-native ES modules:
  - `public/js/main.js`
  - `public/js/client/config.js`
  - `public/js/client/ui.js`
  - `public/js/client/scene.js`
- Removed unfinished runtime paths for weather, zones, achievements, and abilities from the playable client.

Verification:
- `node --check server.js`
- `node --check src/socket/socketManager.js`
- `node --check src/models/GameState.js`
- Installed runtime dependencies with `npm install --no-package-lock`
- Installed Playwright locally for validation with `npm install --no-save --no-package-lock playwright`
- Ran the required `develop-web-game` Playwright client multiple times against `http://localhost:25565`
- Reviewed screenshots and `render_game_to_text` outputs under:
  - `output/web-game/initial-2`
  - `output/web-game/initial-5`
  - `output/web-game/collect-1`
- Confirmed the core loop works end-to-end:
  - start from menu
  - enter play state
  - move using keyboard input
  - collect a golden ball
  - update score to `30`
  - increase player size to `1.15`
  - keep leaderboard synced
- Verified reconnect recovery with a forced engine close: state returned to `playing`, `connection = Arena ao vivo`, `playerCount = 1`
- Verified fullscreen in a headed Playwright pass: `document.fullscreenElement === true` after pressing `f`

Loose ends:
- `package-lock.json` was already deleted before work started and remains deleted.
- `bun.lock` was already present before work started and was left untouched.

Follow-up fixes:
- Adjusted local movement in `public/js/main.js` so gameplay camera heading stays fixed during movement instead of being reoriented by input.
- Removed the spawn-time nearest-ball camera heading override, which was making left/right semantics depend on a random spawn orientation.
- Re-ran the required Playwright client for:
  - `output/web-game/input-a`
  - `output/web-game/input-d`
  - `output/web-game/input-s`
- Added a direct Playwright probe to validate control math:
  - `A` moved negative along camera-right: `deltaX = -7.92`
  - `D` moved positive along camera-right: `deltaX = 6.79`
  - `S` moved backward: `deltaZ = -6.6`
  - `cameraHeading` delta stayed `0` for all three cases

Final control fix:
- Corrected the strafe vector sign in `public/js/main.js` so lateral input matches the on-screen camera orientation.
- Revalidated after the fix with fresh runs:
  - `output/web-game/input-a-2`
  - `output/web-game/input-d-2`
  - `output/web-game/input-s-2`
- Final direct probe results:
  - `A`: `deltaX = 7.16`, `headingDelta = 0`
  - `D`: `deltaX = -7.35`, `headingDelta = 0`
  - `S`: `deltaZ = -6.78`, `headingDelta = 0`

HUD cleanup:
- Removed the visible HUD badge/status duplication that showed `Arena ao vivo` twice.
- Updated the active status line to stop echoing connection text.
- Turned the in-game instruction panel into a temporary hint: it now starts visible when the session begins, fades, and disappears after 10 seconds.

Toast cleanup:
- Removed the pickup-time top toast from `handleBallCollected` in `public/js/main.js`.
- Welcome/random join copy is now only emitted on `playerInfo` when the local player enters the session.
- Kept the pickup feedback limited to the in-world burst and `+value` indicator.

Follow-up fixes:
- Adjusted local movement in `public/js/main.js` so `A`/`D` stay as camera-relative strafes.
- Stopped the orbit heading from following pure strafe/backpedal input, which fixes the `S` camera spin.
- Re-ran the required Playwright client for:
  - `output/web-game/input-a`
  - `output/web-game/input-d`
  - `output/web-game/input-s`
- Added a direct Playwright probe to validate control math:
  - `A` moved negative along camera-right
  - `D` moved positive along camera-right
  - `S` moved backward along camera-forward
  - `cameraHeading` delta stayed `0` for all three cases

Camera + toast follow-up:
- Gated the join toast in `public/js/main.js` with `hasShownJoinToast`, resetting only on a fresh session start.
- Kept `playerInfo` as a general sync event, but stopped treating every `playerInfo` after collection as a new join.
- Increased gameplay camera scaling in `public/js/client/scene.js` so distance and height now grow proportionally with `sizeMultiplier`.
- Re-ran the required `develop-web-game` client:
  - `output/web-game/camera-grow-smoke`
- Ran a direct Playwright verification with forced collection:
  - `output/web-game/camera-grow-verify/before-collect.png`
  - `output/web-game/camera-grow-verify/after-collect.png`
  - `output/web-game/camera-grow-verify/result.json`
- Verification result:
  - initial camera distance: `32.22`
  - after collecting one golden ball: `41.07`
  - size multiplier changed from `1` to `1.15`
  - join toast was hidden before collection and stayed hidden after collection
  - pickup feedback remained limited to `+30`
  - no new browser console errors

Fast-pickup toast fix:
- Added `hideToast()` to `public/js/client/ui.js`.
- Local `ballCollected` handling in `public/js/main.js` now clears the top toast immediately before showing pickup feedback, so the join message cannot linger on-screen during a quick first pickup.
- Re-ran the required `develop-web-game` client:
  - `output/web-game/toast-hide-smoke`
- Ran a direct Playwright fast-collection verification:
  - `output/web-game/toast-hide-verify/after-fast-collect.png`
  - `output/web-game/toast-hide-verify/result.json`
- Verification result:
  - join toast was visible right after entry
  - after a fast golden-ball pickup, top toast was hidden
  - pickup feedback remained visible as `+30`
  - no new browser console errors

Camera measurement sanity check:
- Ran an isolated camera-distance probe at the same player position after forcing `sizeMultiplier` from `1` to `1.15`.
- Clean camera offset increased from `10.76` to `12.92`, confirming proportional zoom-out without position/clamp noise.

Remote deploy:
- Synced the current workspace to `server:~/pegabola3000/` with `rsync`, excluding `.git`, `node_modules`, and `output`.
- Installed runtime dependencies remotely with `npm install`.
- Replaced the old duplicated `node --watch server.js` processes with a single detached `/usr/bin/node server.js`.
- Remote app validation:
  - host: `server` (`192.168.1.66`)
  - path: `~/pegabola3000`
  - port: `25565`
  - HTTP check to `http://192.168.1.66:25565` returned `200 OK`

Cloudflared:
- Opened a detached quick tunnel on the remote host with `cloudflared tunnel --protocol http2 --url http://localhost:25565`.
- Current quick tunnel URL from `~/pegabola3000/cloudflared.log`:
  - `https://yeast-cuts-showers-crop.trycloudflare.com`
- Current detached tunnel process:
  - PID `1664217`
- Caveat:
  - Cloudflared reports the tunnel as registered, but external validation from this environment still returns `404` from the Cloudflare edge rather than the app HTML.

Named tunnel replacement:
- Created a dedicated named tunnel for the game:
  - name: `pegabola3000-game`
  - id: `b8fc6ed4-e5f5-4aac-b920-19504fbb837b`
- Wrote a dedicated config at:
  - `/home/hevlyo/.cloudflared/pegabola3000-game.yml`
- Configured ingress:
  - `pegabola.goathub.space -> http://localhost:25565`
  - fallback `http_status:404`
- Added the DNS route:
  - `cloudflared tunnel route dns b8fc6ed4-e5f5-4aac-b920-19504fbb837b pegabola.goathub.space`
- Started the named tunnel as a detached user process:
  - command: `cloudflared tunnel --config /home/hevlyo/.cloudflared/pegabola3000-game.yml run`
  - pid: `1673675`
- Validation:
  - `dig +short pegabola.goathub.space` resolved
  - `curl https://pegabola.goathub.space` returned `200`
  - tunnel info shows active edge connections for `pegabola3000-game`

Sprint agar-like implementation:
- Server config/state:
  - added reconnect grace window in `src/config/gameConfig.js`
  - promoted player identity from transient `socket.id` to stable session-backed ids in `src/models/GameState.js`
  - server now keeps disconnected players in memory for a short reconnect window while public snapshots/counts only expose connected players
  - movement, collection, score updates, consume/respawn, and disconnect broadcasts now use stable player ids
- Client/runtime:
  - added session id persistence in `public/js/main.js` via `sessionStorage`
  - `joinGame` now sends `sessionId`
  - removed the temporary `localPlayerId = socket.id` assignment on connect so the client stays keyed to the stable player id from `playerInfo`
  - `playerState` and `playerConsumed` now force an immediate HUD/scene refresh for local readability
- Existing sprint features kept and validated together:
  - authoritative player consume + respawn
  - respawn invulnerability window
  - real `SPEED` boost with timer in `render_game_to_text`
  - PvP killfeed / state chip / consume + respawn bursts

Verification on the final server instance:
- `node --check` passed for:
  - `public/js/main.js`
  - `src/models/GameState.js`
  - `src/socket/socketManager.js`
  - `public/js/client/config.js`
- Re-ran the required `develop-web-game` client on the final runtime:
  - `output/web-game/sprint-pvp/smoke`
- Re-ran the full multi-page Playwright verification on the final runtime:
  - `output/web-game/sprint-pvp/verify/result.json`
  - `output/web-game/sprint-pvp/verify/big-after-pvp.png`
  - `output/web-game/sprint-pvp/verify/small-after-respawn.png`
  - `output/web-game/sprint-pvp/verify/speed-after-pickup.png`
- Added an explicit reconnect preservation probe:
  - `output/web-game/sprint-pvp/reconnect-check.json`

Final verification summary:
- equal-size collision: no consume
- bigger player: consumes smaller and leaderboard updates
- protected respawn: immediate re-consume blocked
- second consume after invulnerability: passed
- `SPEED`: score + buff applied, HUD chip present in runtime, movement increased from `5.19` to `7.006`, and buff expired correctly
- reconnect: stable player id persisted and a short disconnect preserved score + active `SPEED` timer
- no new console/page errors in the final Playwright runs

Notes / residuals:
- This environment does not have `bun` installed, so runtime validation was executed with `node server.js`; the package contract remains `bun run start` because the script still points to `node --watch server.js`.
- The second-respawn protection chip passes the runtime assertion in `verify.mjs`, but the captured screenshot can still miss it intermittently; if visual proof of that chip is important, capture a dedicated frame after a slightly longer post-respawn delay.

Remote redeploy on 2026-04-09 14:48:18 -03:
- Synced the current workspace to `server:~/pegabola3000/` with:
  - `rsync -az --delete --exclude .git --exclude node_modules --exclude output --exclude .codex ./ server:~/pegabola3000/`
- Refreshed remote dependencies with:
  - `ssh server "cd ~/pegabola3000 && npm install"`
- Replaced the remote game process with a fresh detached instance:
  - `ssh server "cd ~/pegabola3000 && nohup /usr/bin/node server.js > server.log 2>&1 < /dev/null & echo \$!"`
  - active app pid: `2912510`
- Validation:
  - `ssh server "curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:25565"` returned `200`
  - `ssh server "curl -s -o /dev/null -w '%{http_code}\n' https://pegabola.goathub.space"` returned `200`
- Tunnel status:
  - existing named tunnel process still active on `server`
  - tunnel pid observed: `1673675`

Camera growth smoothing fix on 2026-04-09 15:03:34 -03:
- Bug investigated:
  - when `sizeMultiplier` increased, the gameplay camera recalculated its follow offset immediately from the final scale, which caused a visible snap/flicker during growth
- Fix applied:
  - added `cameraZoomOutSmoothing` and `cameraZoomInSmoothing` to `public/js/client/config.js`
  - `public/js/client/scene.js` now keeps a camera-only tracked scale (`cameraTrackedScale`) per followed player
  - the camera uses that tracked scale for distance, height, and look target instead of jumping directly to the new player scale
  - the tracked scale resets when returning to idle camera so first join/spawn framing stays sane
- Validation:
  - `node --check public/js/client/config.js`
  - `node --check public/js/client/scene.js`
  - smoke with the `develop-web-game` Playwright client:
    - `output/web-game/camera-smoothing-smoke`
  - direct browser probe with a forced local growth from `1.00` to `1.15` after camera settle:
    - `output/web-game/camera-smoothing-verify-settled/result.json`
    - `output/web-game/camera-smoothing-verify-settled/after-growth.png`
  - measured response after settle:
    - camera distance moved smoothly from `10.765` to `12.185`
    - first frame after growth was only `10.776` with tracked camera scale `1.007`
    - no console or page errors during the verification run

Camera growth cut follow-up on 2026-04-09 15:40:14 -03:
- Residual issue:
  - even with the camera follow offset smoothed, the local player mesh was still scaling instantly on growth
  - that visual pop made the camera change still feel like a hard cut in moment-to-moment play
- Follow-up fix applied:
  - added `playerScaleGrowSmoothing` and `playerScaleShrinkSmoothing` to `public/js/client/config.js`
  - `public/js/client/scene.js` now keeps a per-mesh `displayScale` and interpolates the avatar/rings/shadow/label toward the real gameplay scale
  - the gameplay camera now keys off the same smoothed render scale instead of reacting to the raw player scale directly
- Validation:
  - `node --check public/js/client/config.js`
  - `node --check public/js/client/scene.js`
  - smoke with the `develop-web-game` client:
    - `output/web-game/camera-flicker-fix-smoke`
  - clean scale-only browser probe:
    - `output/web-game/camera-flicker-fix-scale-only/result.json`
    - `output/web-game/camera-flicker-fix-scale-only/after-growth.png`
  - networked collect probe for regressions:
    - `output/web-game/camera-flicker-fix-verify/result.json`
    - `output/web-game/camera-flicker-fix-verify/after-real-collect.png`
- Measured result on the clean probe:
  - `displayScale` moved smoothly from `1.000` to `1.150`
  - first frame after growth was `displayScale = 1.033`
  - camera distance moved from `10.765` to `12.661` with no instant jump and no browser errors

Sprint fixes batch on 2026-04-09 16:05:59 -03:
- Input / context menu:
  - blocked the browser context menu on right click and reset movement input state when it is attempted
  - added extra input reset on `blur` and `visibilitychange` to stop stuck movement states
- Arena / world:
  - increased world size from `50` to `72` on both client and server
  - added solid arena wall padding on both sides of the protocol so player centers clamp before crossing the border ring
  - spawn slots now scale with the larger arena instead of staying clustered in the old center footprint
- Consume / respawn:
  - when movement causes a consume, the moving socket now also receives an explicit `playerState`
  - this fixes the case where a smaller moving player hit a larger stationary player, got the toast, but did not visibly respawn on the client
  - local input is also cleared on death to avoid immediate drift out of respawn
- Memory / runtime hygiene:
  - reused hot-path `THREE.Vector3` instances in movement and camera code to avoid per-frame allocations
  - added `GameApp.destroy()` and `SceneController.dispose()` cleanup paths for sockets, timers, audio, meshes, bursts, renderer state, and canvas removal
  - added `ui.destroy()` so menu/toast/killfeed timers and listeners are cleared on teardown
  - validated that pickup bursts are released after their animation instead of accumulating
- Validation:
  - `node --check public/js/main.js`
  - `node --check public/js/client/config.js`
  - `node --check public/js/client/ui.js`
  - `node --check public/js/client/scene.js`
  - `node --check src/models/GameState.js`
  - `node --check src/socket/socketManager.js`
  - `node --check src/config/gameConfig.js`
  - smoke with the `develop-web-game` client:
    - `output/web-game/sprint-fixes-smoke`
  - focused two-player verification:
    - `output/web-game/sprint-fixes-verify/result.json`
    - `output/web-game/sprint-fixes-verify/player-a-after-respawn.png`
    - `output/web-game/sprint-fixes-verify/verify.mjs`
- Key verification results:
  - right-click context menu prevented and all movement keys reset to `false`
  - smaller player with score `35` colliding into a larger stationary player with score `85` was consumed correctly, respawned at `(20, 20)`, and received invulnerability
  - larger winner ended at score `120`, confirming score transfer on consume
  - border movement stayed inside the new world limit (`x = 63.131`, `z = 63.131`, `inside = true`)
  - pickup burst cleanup ended with `pickupBursts = 0`
  - destroy path left `window.__pegaBolaApp` removed, socket cleared, scene disposed, and `canvasCount = 0`

Remote redeploy on 2026-04-09 17:14:59 -03:
- Synced the current workspace to `server:~/pegabola3000/` with:
  - `rsync -az --delete --exclude .git --exclude node_modules --exclude output --exclude .codex ./ server:~/pegabola3000/`
- Refreshed remote dependencies with:
  - `ssh server "cd ~/pegabola3000 && npm install"`
- Replaced the remote game process with a fresh detached instance:
  - `ssh server "cd ~/pegabola3000 && nohup /usr/bin/node server.js > server.log 2>&1 < /dev/null & echo \$!"`
  - active app pid: `3076392`
- Validation:
  - `ssh server "curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:25565"` returned `200`
  - `ssh server "curl -s -o /dev/null -w '%{http_code}\n' https://pegabola.goathub.space"` returned `200`
- Tunnel status:
  - existing named tunnel process still active on `server`
  - tunnel pid observed: `1673675`

Collect transition smoothing fix on 2026-04-09 17:28:58 -03:
- Residual issue:
  - collecting a ball still felt abrupt because the local `playerState` update used the same hard-sync path as collision corrections
  - that hard sync reset the local player position/velocity on score updates, producing a visible cut right at pickup
- Fix applied:
  - `src/socket/socketManager.js` now tags `playerState` payloads with `syncMode`
  - collect updates emit `syncMode: 'score'`
  - movement correction updates emit `syncMode: 'corrected'`
  - consume fallback updates emit `syncMode: 'consumed'`
  - `public/js/main.js` no longer hard-syncs every local `playerState`; it only hard-syncs when `syncMode === 'corrected'`
  - local score/growth updates now refresh HUD/scene without zeroing movement or snapping the player back
- Validation:
  - `node --check public/js/main.js`
  - `node --check src/socket/socketManager.js`
  - smoke with the `develop-web-game` client:
    - `output/web-game/collect-smoothing-smoke`
  - focused score-sync probe:
    - `output/web-game/collect-smoothing-verify/result.json`

  Consume-by-action rework on 2026-04-10:
  - Motivation:
    - with smoother player collision, passive auto-consume on touch became confusing and created accidental devours
    - gameplay needed a clear intention signal to keep collisions readable
  - Rule change implemented:
    - devour no longer happens by mere contact
    - devour now requires consume intent from:
      - explicit key action (`R`)
      - or dash window (dash also arms consume intent briefly)
    - existing size and distance validation were preserved
  - Server-side changes:
    - added `CONSUME_INTENT_WINDOW_MS` in `src/config/gameConfig.js`
    - added `consumeIntentUntil` to player state in `src/models/GameState.js`
    - dash activation now also grants consume intent window
    - added `triggerConsumeIntent(socketId)` to process explicit consume attempts
    - consume candidate checks (`checkPassiveConsumption` and `resolvePlayerConsumption`) now require active consume intent
    - consume intent timeout now expires in timed-state refresh
    - new socket event handling in `src/socket/socketManager.js`:
      - `playerConsumeAttempt` -> immediate consume attempt + response broadcast
  - Client-side changes:
    - bound `R` key in `public/js/main.js` to emit `playerConsumeAttempt`
    - kept dash trigger on `Space`; dash remains valid consume-intent source
    - updated HUD tips in `public/js/client/config.js` to reflect the new mechanic
  - Verification:
    - static checks passed with no new editor errors in:
      - `public/js/main.js`
      - `src/models/GameState.js`
      - `src/socket/socketManager.js`
      - `src/config/gameConfig.js`
      - `public/js/client/config.js`
    - `output/web-game/collect-smoothing-verify/after-score-sync.png`
    - `output/web-game/collect-smoothing-verify/verify.mjs`
- Key verification results:
  - after a local score sync, velocity stayed at `0.19` instead of dropping to `0`
  - the local player kept moving continuously for all sampled frames after the score update
  - sample path stayed monotonic on `z`: `-18.67 -> -1.57`
  - no console or page errors during the probe

Camera boom smoothing follow-up on 2026-04-09 17:46:56 -03:
- Residual issue:
  - even after removing the local hard-sync on score updates, the camera readjustment after pickup was still perceptible
  - the remaining problem was the camera boom reacting too directly to the new size target
- Follow-up fix applied:
  - `public/js/client/scene.js` now keeps dedicated camera boom state for distance, height, and look height
  - pickup growth no longer drives camera zoom from the mesh scale directly on the same frame
  - the camera now interpolates toward boom targets with slower zoom-out smoothing and its own look-height smoothing
  - `public/js/client/config.js` was retuned for the new boom timing
- Validation:
  - `node --check public/js/client/config.js`
  - `node --check public/js/client/scene.js`
  - smoke with the `develop-web-game` client:
    - `output/web-game/collect-smoothing-smoke`
  - focused camera boom probe:
    - `output/web-game/collect-smoothing-verify/result.json`
    - `output/web-game/collect-smoothing-verify/after-score-sync.png`
    - `output/web-game/collect-smoothing-verify/verify.mjs`
- Key verification results:
  - `cameraBoomDistance` changed smoothly from `8.800` to `8.811` on the first post-score frame
  - over 16 sampled frames it advanced progressively to `9.131`
  - no new browser errors during the probe

Remote redeploy on 2026-04-09 18:02:10 -03:
- Synced the current workspace to `server:~/pegabola3000/` with:
  - `rsync -az --delete --exclude .git --exclude node_modules --exclude output --exclude .codex ./ server:~/pegabola3000/`
- Refreshed remote dependencies with:
  - `ssh server "cd ~/pegabola3000 && npm install"`
- Replaced the remote game process with a fresh detached instance:
  - `ssh server "cd ~/pegabola3000 && nohup /usr/bin/node server.js > server.log 2>&1 < /dev/null & echo \$!"`
  - active app pid: `3129719`
- Validation:
  - `ssh server "curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:25565"` returned `200`
  - `ssh server "curl -s -o /dev/null -w '%{http_code}\n' https://pegabola.goathub.space"` returned `200`
- Tunnel status:
  - existing named tunnel process still active on `server`
  - tunnel pid observed: `1673675`

Camera growth framing follow-up on 2026-04-09 18:27:18 -03:
- Residual issue:
  - pickup pulse existed, but long-term camera growth framing was still too conservative
  - larger players could still dominate the screen instead of gaining meaningful map visibility
- Follow-up fix applied:
  - `public/js/client/config.js` now defines explicit growth response for distance, height, and FOV
  - `public/js/client/scene.js` now drives a smoothed `cameraCurrentFov` in addition to distance/height
  - growth now scales camera distance/height more aggressively as `sizeMultiplier` rises
  - pickup zoom boost now includes a small temporary FOV pulse so collection still feels responsive while settling into the larger framing
- Validation:
  - `node --check public/js/client/config.js`
  - `node --check public/js/client/scene.js`
  - `node --check public/js/main.js`
  - smoke with the `develop-web-game` client:
    - `output/web-game/camera-growth-smoke/shot-0.png`
  - focused growth probe:
    - `output/web-game/camera-growth-verify/result.json`
    - `output/web-game/camera-growth-verify/after-growth.png`
- Key verification results:
  - after growing from `sizeMultiplier 1.00` to `1.75`, `cameraBoomDistance` rose from `8.800` to `22.710`
  - `camera.fov` widened from `60.0` to `70.927`
  - framing ratio dropped from `0.1136` to `0.0771`, confirming the player occupies less of the screen at larger size
  - no browser errors during smoke or probe
