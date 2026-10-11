# M193 — Real-browser guard-break, block-only timing

## Regression

M192 merged to main as `c4458fb1` after passing the real heavy-defense gates. The resulting [main quality run #38139942679](https://github.com/tehki/myaso/actions/runs/38139942679) passed the M188 six-repeat heavy gate and original M107 but failed M34. A genuine Firefox wheel-back resolved as a **parry** against Chrome's first real LMB light. Subsequent blocked light strikes could not exhaust the defender's 100 guard within the four-attempt allowance. Firefox remained at 100 HP, 29 guard; the test properly failed.

## Correction

M34 previously dispatched a real Firefox wheel, waited 35ms in Node, then dispatched a Chrome W3C LMB burst. Browser/driver and network input ingress can compress this lead and put light impact inside the unchanged 125ms parry window. M193 pre-arms both real browser commands concurrently. Chrome's W3C pointer action itself pauses 75ms before sending the actual three-click LMB burst, so the nominal wheel-to-light-impact window is 75ms + 135ms light windup = 210ms: past 125ms parry but within the 240ms short block.

Every exchange now fails immediately on genuine parry feedback or any loss of 100 HP. Diagnostic output records attacker/defender feedback, guard, wheel count, and real pointer-down count. The original strict end-to-end guard-break result is unchanged: genuine block pressure of -38, 0 remaining guard, and server-generated break feedback. No synthetic browser combat input, no change to server authority, damage, stamina, block/parry windows or protocol.

## Qualification

- Three independent fresh Chrome/Firefox M34 `uiguardbreak` runs execute near the start of the quality job.
- Original M34/M40 and M188/M107/FFA/Rust/JavaScript/M8 authoritative capacity gates remain required for a merge.
- No playable build or production deployment.
