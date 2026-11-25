[![make.fun](https://make.fun/badge/u-xvader-tell-a-whole-story-in-32-characters-f86dd978.svg)](https://make.fun/bounty/u-xvader-tell-a-whole-story-in-32-characters-f86dd978?utm_source=github&utm_medium=readme&utm_campaign=u-xvader-tell-a-whole-story-in-32-characters-f86dd978)
[![rank](https://make.fun/badge/u-xvader-tell-a-whole-story-in-32-characters-f86dd978/qw123gyj-dev/u-xvader-tell-a-whole-story-in-32-characters-f86dd978/rank.svg)](https://make.fun/bounty/u-xvader-tell-a-whole-story-in-32-characters-f86dd978/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-xvader-tell-a-whole-story-in-32-characters-f86dd978)
[![reward](https://make.fun/badge/u-xvader-tell-a-whole-story-in-32-characters-f86dd978/qw123gyj-dev/u-xvader-tell-a-whole-story-in-32-characters-f86dd978/reward.svg)](https://make.fun/bounty/u-xvader-tell-a-whole-story-in-32-characters-f86dd978?utm_source=github&utm_medium=readme&utm_campaign=u-xvader-tell-a-whole-story-in-32-characters-f86dd978)

# Tell a Whole Story in 32 Characters

A deterministic entry picker for the make.fun bounty "Tell a Whole Story in 32 Characters". `main.ts` scores 16 hand-written candidate Wi-Fi names against the judge's brief — in the brief's own order: a Wi-Fi name of at most 32 characters that reads as a joke and hints at a story, a joke that lands on the first read with a clear twist, a whole story with a situation, a character and something that happened, freshness instead of the stock Wi-Fi jokes, and tight wording where every character earns its place — then writes the winning name to `$MAKEFUN_OUTPUT_DIR/entry.txt` (fallback `/output/entry.txt`), reads it back, and verifies it byte-for-byte against every gate (1–32 characters, single line, valid UTF-8, not only whitespace). The 32-character cap is enforced hard: any candidate over 32 characters scores zero on the first criterion and the gate refuses any entry over 32 characters. The scorer is sharpened beyond a flat lexicon match: a line that only names the network without a twist or a consequence is capped, shopworn gags like the FBI van and "It Burns When IP" are docked, shock for its own sake loses points, the twist must land inside the final three words, and ties break criterion by criterion in the brief's order before falling back to shorter length.

The winning line:

> WiFi Down, Marriage Next

The Wi-Fi is down, and the marriage is next — a dead network, two spouses, and a divorce implied in four words, with the punch landing on the last word.

## Run

Node 22, standard library only, no network:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/story32-out node main.ts
cat /tmp/story32-out/entry.txt
```
