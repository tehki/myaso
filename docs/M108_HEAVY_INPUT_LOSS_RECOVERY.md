# M108 — Heavy Strike Recovery Under First-Send Input Loss

## Objective

Prove end-to-end, with real Chrome/Firefox controls, that the playable M106/M107 heavy strike survives deliberate loss of the first action-bearing input datagram through the existing M63 three-sample redundancy path.

## Base

M107 exact green head `a0211049f2bcbd5251a3aeb1a89b5eca13b0cc93`.

Quality run `36109876400`, job `107990675182`: PASS.

M107 already proves real heavy block/parry/dodge counterplay. M108 closes the remaining transport acceptance gap: M105 unit tests prove heavy participates in redundant one-shot coalescing, but no real-browser scenario had yet pressed `E` while the first-send action packet was actually discarded.

## Scenario

New scenario:

`MYASO_PVP_SCENARIO=uiheavyinputloss`

It reuses the exact green M106 `uiheavy` browser flight:

- Chrome attacker;
- Firefox defender;
- real movement key staging;
- real `KeyE` down/up heavy edge;
- authoritative single 46-damage result;
- attacker sees defender exactly 54 HP;
- defender sees self exactly 54 HP;
- `Opponent hit - 46 HP.` / `Hit taken - 46 HP.`;
- heavy windup/strike threat phase observed;
- heavy recovery observed as `PUNISH · Heavy recovery`;
- attacker renders heavy commitment/recovery hint.

## Deliberate loss

For this scenario only the existing loopback-only server fixture runs with:

`MYASO_FLIGHT_DROP_NEW_ACTION_DATAGRAMS=1`

The fixture discards decoded input datagrams whose newest sample carries a one-shot action, including the M105 heavy-attack bit.

The next ordinary client packet may still carry that heavy tick in its two-sample redundancy history. Existing ingress deduplication plus M63/M105 coalescing then recover the one-shot exactly once.

Acceptance additionally requires at least one server marker:

`M63_INPUT_ACTION_PACKET_DROPPED`

This prevents the scenario from passing if the deliberate-loss fixture was not actually exercised.

## Why one drop is sufficient

Unlike the historical M63 `inputloss` scenario, which drives action exchanges from both browsers and therefore requires at least two deliberate drops, `uiheavyinputloss` intentionally has one heavy attacker and one passive defender.

The expected minimum is therefore one dropped first-send heavy datagram.

## Production boundary

M108 changes no production gameplay, protocol, rendering, input cadence, packet size, replication, persistence, or runtime behavior.

The delta is limited to:

- browser acceptance harness scenario registration;
- enabling the pre-existing loopback-only loss fixture for that scenario;
- one focused CI gate;
- milestone documentation.

Default/production runtime still receives every input datagram offered by transport.

## Focused CI

`Validate M108 heavy recovery under first-send input loss`

runs:

- JavaScript syntax check for the PvP browser harness;
- the real Chrome/Firefox `uiheavyinputloss` flight.

All inherited M107 and earlier quality gates remain required.

## Rollback

Close/discard M108; M107 remains the exact green heavy-counterplay base.
