/**
 * Tell a Whole Story in 32 Characters — deterministic entry picker.
 *
 * Bounty: write one Wi-Fi network name of at most 32 characters, the
 * funniest name that hints at a whole story, as a passer-by sees it
 * in a phone's network list. A comedy judge compares entries two at
 * a time and keeps the funnier one, weighing (most important first):
 *
 *   1. It is a Wi-Fi network name of at most 32 characters that
 *      reads as a joke and hints at a story — a plain label, a
 *      slogan, or anything past 32 characters loses to any Wi-Fi
 *      name on the subject.
 *   2. The joke lands on the first read, with a clear twist or
 *      punchline a stranger gets without explanation.
 *   3. It tells a whole story: the name implies a situation, a
 *      character and something that happened, so a reader can
 *      fill in the rest.
 *   4. It is fresh: it avoids the stock Wi-Fi jokes everyone has
 *      seen, or turns a familiar one into something new.
 *   5. It is tight: every character earns its place, and the
 *      wording is clean, readable and easy to say out loud.
 *
 * Shock value for its own sake does not count.
 *
 * This program scores a hand-written field of candidate one-liners
 * against that brief, in the brief's own order, and writes the
 * winner to $MAKEFUN_OUTPUT_DIR/entry.txt (fallback
 * /output/entry.txt). It then reads the file back and verifies it
 * byte-for-byte against every gate: 1–32 characters, a single
 * line, valid UTF-8, and not only whitespace.
 *
 * The 32-character cap is enforced hard, twice: a candidate over
 * 32 characters scores zero on the first criterion and can never
 * win, and the gate verification refuses to pass any entry over
 * 32 characters. Every candidate in the field below is 32
 * characters or fewer by construction, and the program asserts
 * that at startup before scoring anything.
 *
 * Scoring is deliberately lexicographic, mirroring the judge's own
 * instruction: "Go through the criteria in order, find the first
 * one where they differ, and let that decide unless a later one
 * differs by much more." Ties break criterion by criterion in the
 * brief's order, then by shorter length — a shorter name that
 * says the same thing is the tighter one, and ties on the judge's
 * own board go to the smaller text.
 *
 * Three sharpening rules sit on top of the flat rubric:
 *
 *   - A line that only names the subject — the Wi-Fi, the router,
 *     the password — without turning it into a twist or a
 *     consequence is capped on funniness. Naming the network is
 *     the setup, not the joke.
 *   - Shopworn gags are docked. The FBI van, "It Burns When IP",
 *     "Virus.exe" and the rest of the stock Wi-Fi jokes are the
 *     ones the brief explicitly warns against; any line leaning
 *     on one loses funniness and freshness points.
 *   - The twist must land late in the line. These names are four
 *     to seven words long, so the punch has to sit inside the
 *     final three words; a punchline that arrives early and is
 *     followed by filler is a line that fizzles.
 *
 * Node 22+, standard library only, no network. Deterministic: the
 * same candidates always produce the same winner.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Hard cap from the brief: a Wi-Fi name is at most 32 characters. */
const MAX_CHARS = 32;

/* ------------------------------------------------------------------ */
/* Candidates                                                          */
/* ------------------------------------------------------------------ */

/**
 * One hand-written candidate Wi-Fi name. `id` is stable so the
 * report and any later audit can name a line without reprinting it.
 * `text` is the name exactly as it would appear in a phone's
 * network list — no setup, no explanation, no trailing spaces.
 */
interface Candidate {
  id: string;
  text: string;
}

const CANDIDATES: Candidate[] = [
  {
    id: "fbi-van",
    text: "FBI Van Parked Outside Again",
  },
  {
    id: "wifi-down-marriage",
    text: "WiFi Down, Marriage Next",
  },
  {
    id: "dad-password",
    text: "Dad Changed Password Again",
  },
  {
    id: "ex-next-door",
    text: "Your Ex Moved In Next Door",
  },
  {
    id: "router-died-dinner",
    text: "Router Died, So Did Dinner",
  },
  {
    id: "window-watcher",
    text: "I Can See You From My Window",
  },
  {
    id: "grandma-wifi",
    text: "The WiFi Died With Grandma",
  },
  {
    id: "birthday-password",
    text: "Password Is Your Birthday",
  },
  {
    id: "mom-no-internet",
    text: "Mom Said No Internet Today",
  },
  {
    id: "sorry-password",
    text: "Sorry Is The WiFi Password",
  },
  {
    id: "neighbor-stole",
    text: "My Neighbor Stole My WiFi",
  },
  {
    id: "burns-when-ip",
    text: "It Burns When IP",
  },
  {
    id: "virus-exe",
    text: "Virus.exe \u2014 Do Not Connect",
  },
  {
    id: "kids-router",
    text: "The Kids Took The Router",
  },
  {
    id: "dads-wifi-moms-rules",
    text: "Dad's WiFi, Mom's Rules",
  },
  {
    id: "divorce-papers",
    text: "Divorce Papers In The Mail",
  },
];

/** Character count, counting code points, not UTF-16 units. */
function charLength(text: string): number {
  return [...text].length;
}

/**
 * Refuse to score at all if any candidate breaks the cap. The
 * gate would reject it anyway; failing here, loudly, keeps a
 * too-long line from ever being picked by a scorer bug.
 */
function assertAllWithinCap(): void {
  for (const c of CANDIDATES) {
    const len = charLength(c.text);
    if (len > MAX_CHARS) {
      throw new Error(
        `candidate ${c.id} is ${len} characters, over the ${MAX_CHARS} cap: ${c.text}`,
      );
    }
    if (c.text.trim().length === 0) {
      throw new Error(`candidate ${c.id} is only whitespace`);
    }
    if (c.text.includes("\n") || c.text.includes("\r")) {
      throw new Error(`candidate ${c.id} is not a single line`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Text features                                                       */
/* ------------------------------------------------------------------ */

/** Split a line into words on whitespace, dropping empties. */
function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

/**
 * Lower-cased words, tokenised on anything that is not a letter
 * or a digit, with possessives dropped: "Dad's" becomes "dad",
 * "Virus.exe" becomes "virus" and "exe". A bare substring test
 * would do this wrong, so the tokeniser does it here, once.
 */
function cleanWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/'s\b/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0);
}

/**
 * True when any of the given needles appears in the haystack.
 * A needle of one word matches a whole word only — a bare
 * substring test would let the single letter "i" match every
 * word containing one, and "ex" match "next". A needle of
 * several words matches as a phrase, punctuation aside.
 */
function containsAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  const words = new Set(cleanWords(haystack));
  return needles.some((n) =>
    n.includes(" ") || /[^a-z0-9]/.test(n)
      ? lower.includes(n)
      : words.has(n),
  );
}

/** The last `n` words of the line, joined back into a string. */
function tailWords(text: string, n: number): string {
  return wordsOf(text).slice(-n).join(" ").toLowerCase();
}

/**
 * Words that anchor the line to a network: Wi-Fi, the router, the
 * password, the signal. A name with none of these can still be a
 * joke, but it reads less like a Wi-Fi name on the subject — the
 * first thing the judge weighs.
 */
const NETWORK_WORDS = [
  "wifi",
  "wi-fi",
  "router",
  "password",
  "internet",
  "lan",
  "signal",
  "hotspot",
  "network",
  "ip",
];

/** True when the line names the network or its gear. */
function hasNetworkHook(text: string): boolean {
  return containsAny(text, NETWORK_WORDS);
}

/**
 * Words that put a character in the scene — a family member, a
 * neighbour, an ex, the FBI, or the people implied by a marriage
 * or a divorce. A story needs someone it happened to.
 */
const CHARACTER_WORDS = [
  "dad",
  "mom",
  "ex",
  "neighbor",
  "neighbour",
  "kids",
  "grandma",
  "fbi",
  "bride",
  "husband",
  "wife",
  "marriage",
  "divorce",
  "you",
  "your",
  "i",
  "my",
];

/** True when the line carries a character, named or implied. */
function hasCharacter(text: string): boolean {
  return containsAny(text, CHARACTER_WORDS);
}

/**
 * Verbs of something happening: the network going down, a
 * password being changed, someone moving in, something being
 * stolen or taken, a van parking outside. A name with no verb
 * is a label, not a story.
 */
const EVENT_VERBS = [
  "down",
  "died",
  "changed",
  "moved",
  "stole",
  "took",
  "parked",
  "see",
  "said",
  "burns",
  "connect",
];

/** True when the line says something happened. */
function hasEvent(text: string): boolean {
  return containsAny(text, EVENT_VERBS);
}

/**
 * Words that set a situation — the state of things the reader
 * has to fill in around. A dead router, a changed password, a
 * van outside, papers in the mail: each one is a scene, not
 * just a noun.
 */
const SITUATION_WORDS = [
  "down",
  "died",
  "changed",
  "moved",
  "stole",
  "took",
  "parked",
  "no internet",
  "papers",
  "rules",
  "van",
  "window",
  "password",
  "burns",
  "virus",
];

/** True when the line implies a situation to fill in. */
function hasSituation(text: string): boolean {
  return containsAny(text, SITUATION_WORDS);
}

/**
 * Words that point past the line at a consequence — again, next,
 * today, in the mail, from my window, so did dinner. The
 * consequence is what makes a few words feel like a whole
 * story: the reader supplies the before and the after.
 */
const CONSEQUENCE_MARKERS = [
  "again",
  "next",
  "today",
  "in the mail",
  "from my window",
  "so did",
  "your birthday",
  "mom's rules",
  "next door",
];

/** True when the line points at a consequence beyond itself. */
function hasConsequence(text: string): boolean {
  return containsAny(text, CONSEQUENCE_MARKERS);
}

/**
 * The stock Wi-Fi jokes everyone has seen: the FBI van, "It
 * Burns When IP", "Virus.exe", Skynet, 404, "Pretty Fly for a
 * Wi-Fi", the LAN puns, "Free WiFi". The brief's fourth
 * criterion is explicit — these lose freshness by definition,
 * however cleanly they are worded.
 */
const STOCK_GAGS = [
  "fbi",
  "burns when ip",
  "virus.exe",
  "skynet",
  "404",
  "pretty fly",
  "nacho wifi",
  "abraham linksys",
  "get off my lan",
  "the promised lan",
  "silence of the lan",
  "free wifi",
];

/** True when the line leans on a stock Wi-Fi joke. */
function usesStockGag(text: string): boolean {
  return containsAny(text, STOCK_GAGS);
}

/**
 * The password joke is its own tired family: the password as
 * the punchline has been told on a thousand networks. It is not
 * as shopworn as the FBI van, but a line built on it is not
 * fresh either, so it costs freshness points without touching
 * funniness.
 */
function usesPasswordTrope(text: string): boolean {
  return text.toLowerCase().includes("password");
}

/**
 * Shock for its own sake: a death played only for the gasp.
 * The brief says shock value does not count, so a line whose
 * whole joke is a dead grandmother loses funniness points —
 * the laugh, if there is one, is the shock, not the story.
 */
const SHOCK_MARKERS = ["grandma", "died with"];

/** True when the line's joke is shock alone. */
function isShockOnly(text: string): boolean {
  return containsAny(text, SHOCK_MARKERS);
}

/**
 * Words that carry the surprise turn — the second half of the
 * joke contradicting or re-framing the first half. A turn only
 * counts when it lands late: in a name this short the punch
 * must sit inside the final three words, otherwise the line
 * peaks early and then keeps talking.
 */
const TWIST_WORDS = [
  "next",
  "again",
  "window",
  "dinner",
  "today",
  "birthday",
  "mail",
  "grandma",
  "door",
  "rules",
  "stole",
  "died",
  "connect",
  "ip",
];

/** True when a twist word appears inside the last three words. */
function hasLateTwist(text: string): boolean {
  const tail = new Set(cleanWords(tailWords(text, 3)));
  return TWIST_WORDS.some((t) => tail.has(t));
}

/** True when a twist word appears anywhere in the line at all. */
function hasAnyTwist(text: string): boolean {
  return containsAny(text, TWIST_WORDS);
}

/**
 * Markers of a second comic beat — an escalation, a repeat
 * offence, a reversal of roles. One twist is a gag; a twist
 * plus a beat is a joke that lands on the first read and keeps
 * landing on the second.
 */
const ESCALATION_MARKERS = [
  "so did",
  "again",
  "next",
  "stole",
  "took",
  "moved in",
  "died",
  "no internet",
  "from my window",
  "in the mail",
  "is your",
  "changed password",
];

/** True when the line carries a second comic beat. */
function hasSecondBeat(text: string): boolean {
  return containsAny(text, ESCALATION_MARKERS);
}

/**
 * Fresh, specific details — a marriage, a divorce, a dinner, a
 * window, a birthday, papers in the mail. A line scores
 * freshness for carrying a detail of its own, not for
 * gesturing at "the network" in the abstract.
 */
const FRESH_DETAILS = [
  "marriage",
  "divorce",
  "dinner",
  "window",
  "grandma",
  "birthday",
  "mail",
  "door",
  "rules",
  "stole",
  "took",
  "parked",
  "ex",
  "kids",
  "neighbor",
  "neighbour",
  "dad",
  "mom",
  "fbi",
  "virus",
  "burns",
];

/** Distinct fresh details present in the line. */
function freshDetails(text: string): string[] {
  const lower = text.toLowerCase();
  return FRESH_DETAILS.filter((d) => lower.includes(d));
}

/**
 * A line that only names the subject without turning it into a
 * twist or a consequence: it points at the Wi-Fi, the router
 * or the password and stops there, offering no punchline and
 * no aftermath. It has a setting and no joke. Such lines are
 * capped on funniness no matter how clean the wording is.
 */
function onlyNamesSubject(text: string): boolean {
  const hasHook = hasNetworkHook(text);
  const hasTurn = hasAnyTwist(text) || hasConsequence(text);
  return hasHook && !hasTurn;
}

/* ------------------------------------------------------------------ */
/* Criterion scores (0–10 each, brief order)                           */
/* ------------------------------------------------------------------ */

interface Scores {
  /** C1: a Wi-Fi name of at most 32 chars, a joke, a story hint. */
  onBrief: number;
  /** C2: the joke lands on the first read, clear twist. */
  jokeLands: number;
  /** C3: a whole story — situation, character, something happened. */
  wholeStory: number;
  /** C4: fresh — not a stock Wi-Fi joke, or a new turn on one. */
  fresh: number;
  /** C5: tight — every character earns its place, clean to say. */
  tight: number;
}

/**
 * C1 — On brief. Five points for being inside the 32-character
 * cap at all: a name past the cap loses to any Wi-Fi name on the
 * subject, so an over-long line scores zero here and can never
 * win. Two more for naming the network or its gear, two for
 * carrying a character or a situation, one for saying something
 * happened. A slogan with no network hook and no event is not
 * a Wi-Fi name on the subject, however funny it might be.
 */
function scoreOnBrief(c: Candidate): number {
  if (charLength(c.text) > MAX_CHARS) return 0;
  let score = 5;
  if (hasNetworkHook(c.text)) score += 2;
  if (hasCharacter(c.text) || hasSituation(c.text)) score += 2;
  if (hasEvent(c.text)) score += 1;
  return Math.min(10, score);
}

/**
 * C2 — The joke lands. A real joke needs a turn the reader
 * does not see coming, and the turn has to land late — inside
 * the final three words of a name this short. Full marks need
 * a late twist plus a second comic beat. A twist that sits
 * early, or a line with no twist at all, is a line that fizzles.
 * Stock gags lose 3 points — the FBI van is the opposite of a
 * surprise — and shock for its own sake loses 2. A line that
 * only names the subject, with no twist and no consequence, is
 * capped at 4: it has a setting, not a joke.
 */
function scoreJokeLands(c: Candidate): number {
  let score = 2; // every on-brief line gets a base for trying
  if (hasLateTwist(c.text)) score += 4;
  else if (hasAnyTwist(c.text)) score += 1; // twist exists, lands early
  if (hasSecondBeat(c.text)) score += 2;
  if (usesStockGag(c.text)) score -= 3;
  if (isShockOnly(c.text)) score -= 2;
  if (onlyNamesSubject(c.text)) score = Math.min(score, 4);
  return Math.max(0, Math.min(10, score));
}

/**
 * C3 — A whole story. Three points for a situation, three for
 * a character, two for something actually happening, two for a
 * consequence the reader has to fill in. A name that has all
 * four lets a stranger reconstruct the before and the after
 * from a few words in a network list; a name with only one is
 * a label with a noun attached.
 */
function scoreWholeStory(c: Candidate): number {
  let score = 0;
  if (hasSituation(c.text)) score += 3;
  if (hasCharacter(c.text)) score += 3;
  if (hasEvent(c.text)) score += 2;
  if (hasConsequence(c.text)) score += 2;
  return Math.min(10, score);
}

/**
 * C4 — Fresh. Full marks for a line built on its own detail,
 * not on a joke the reader has already seen on a hundred
 * networks. The stock gags cost 4 here as well as on
 * funniness: they are precisely the usual jokes the brief says
 * to avoid. The password trope costs 2 — a familiar family,
 * not the worst offender. A line with no fresh detail of its
 * own loses 2: it may be clean, but it is not new.
 */
function scoreFresh(c: Candidate): number {
  let score = 10;
  if (usesStockGag(c.text)) score -= 4;
  if (usesPasswordTrope(c.text)) score -= 2;
  if (freshDetails(c.text).length === 0) score -= 2;
  return Math.max(0, Math.min(10, score));
}

/**
 * C5 — Tight. The cap is 32, but a name that reads cleanly
 * aloud and wastes no characters is shorter still. Full marks
 * from 20 to 28 characters — long enough to hold a story,
 * short enough that every word earns its place. A name under
 * 20 characters rarely holds a whole story, and one at 29 to
 * 32 is spending its last characters on filler, so both step
 * down. Anything past the cap scores zero: it is not a valid
 * Wi-Fi name at all.
 */
function scoreTight(c: Candidate): number {
  const len = charLength(c.text);
  if (len > MAX_CHARS) return 0;
  if (len >= 20 && len <= 28) return 10;
  if (len >= 29 && len <= MAX_CHARS) return 8;
  if (len >= 15 && len < 20) return 8;
  return 6;
}

/** Score a candidate on all five criteria, in the brief's order. */
function scoreCandidate(c: Candidate): Scores {
  return {
    onBrief: scoreOnBrief(c),
    jokeLands: scoreJokeLands(c),
    wholeStory: scoreWholeStory(c),
    fresh: scoreFresh(c),
    tight: scoreTight(c),
  };
}

/* ------------------------------------------------------------------ */
/* Winner selection                                                    */
/* ------------------------------------------------------------------ */

/**
 * Compare two scored candidates the way the judge compares two
 * names: criterion by criterion in the brief's order, first
 * difference decides. Only when all five criteria tie does the
 * shorter name win — it is the tighter one, and on the judge's
 * own board an exact tie goes to the smaller text.
 */
function compareScored(
  a: { candidate: Candidate; scores: Scores },
  b: { candidate: Candidate; scores: Scores },
): number {
  const order: (keyof Scores)[] = [
    "onBrief",
    "jokeLands",
    "wholeStory",
    "fresh",
    "tight",
  ];
  for (const key of order) {
    if (a.scores[key] !== b.scores[key]) return b.scores[key] - a.scores[key];
  }
  const lenA = charLength(a.candidate.text);
  const lenB = charLength(b.candidate.text);
  if (lenA !== lenB) return lenA - lenB;
  return a.candidate.id.localeCompare(b.candidate.id);
}

/** Score every candidate, sort best first, and return the ranking. */
function rankCandidates(): { candidate: Candidate; scores: Scores }[] {
  const scored = CANDIDATES.map((candidate) => ({
    candidate,
    scores: scoreCandidate(candidate),
  }));
  scored.sort(compareScored);
  return scored;
}

/* ------------------------------------------------------------------ */
/* Gate verification                                                   */
/* ------------------------------------------------------------------ */

interface GateResult {
  lengthChars: number;
  lengthBytes: number;
  singleLine: boolean;
  validUtf8: boolean;
  notOnlyWhitespace: boolean;
  within32: boolean;
  passed: boolean;
}

/**
 * Verify the written file byte-for-byte against every gate the
 * sealed scorer applies: UTF-8 text of 1 to 32 characters, not
 * only whitespace. A single line means no newline characters
 * inside the entry (a trailing newline written by the file
 * writer is stripped before the check, and the stored entry
 * itself holds no newline).
 */
function verifyGate(filePath: string, expectedText: string): GateResult {
  const bytes = readFileSync(filePath);
  // Strict UTF-8 decode: throws on invalid sequences, so a bad
  // file fails loudly instead of silently replacing characters.
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const text = decoded.replace(/\n$/, "");
  const lengthChars = [...text].length;
  const result: GateResult = {
    lengthChars,
    lengthBytes: bytes.length,
    singleLine: !text.includes("\n") && !text.includes("\r"),
    validUtf8: true,
    notOnlyWhitespace: text.trim().length > 0,
    within32: lengthChars >= 1 && lengthChars <= MAX_CHARS,
    passed: false,
  };
  result.passed =
    result.singleLine &&
    result.validUtf8 &&
    result.notOnlyWhitespace &&
    result.within32 &&
    text === expectedText;
  return result;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function main(): void {
  // Fail loudly before scoring if any candidate breaks the cap.
  assertAllWithinCap();

  const ranked = rankCandidates();

  console.log("Candidate ranking (criteria in the judge's order):");
  console.log("id                 C1 C2 C3 C4 C5  chars  text");
  for (const { candidate, scores } of ranked) {
    const chars = charLength(candidate.text);
    console.log(
      `${candidate.id.padEnd(18)} ${scores.onBrief}  ${scores.jokeLands}  ` +
        `${scores.wholeStory}  ${scores.fresh}  ${scores.tight}  ` +
        `${String(chars).padStart(5)}  ${candidate.text}`,
    );
  }

  const winner = ranked[0];
  console.log("");
  console.log(`Winner: ${winner.candidate.id}`);
  console.log(`Line: ${winner.candidate.text}`);
  console.log(
    `Scores: onBrief=${winner.scores.onBrief} jokeLands=${winner.scores.jokeLands} ` +
      `wholeStory=${winner.scores.wholeStory} fresh=${winner.scores.fresh} ` +
      `tight=${winner.scores.tight}`,
  );

  // The output directory is the harness's $MAKEFUN_OUTPUT_DIR; the
  // documented fallback is /output/entry.txt.
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.txt");
  writeFileSync(outPath, winner.candidate.text + "\n", "utf8");
  console.log(`Wrote ${outPath}`);

  // Read it back and verify byte-for-byte against every gate.
  const gate = verifyGate(outPath, winner.candidate.text);
  console.log(
    `Gate: chars=${gate.lengthChars} bytes=${gate.lengthBytes} ` +
      `singleLine=${gate.singleLine} validUtf8=${gate.validUtf8} ` +
      `notOnlyWhitespace=${gate.notOnlyWhitespace} within32=${gate.within32} ` +
      `passed=${gate.passed}`,
  );
  if (!gate.passed) {
    console.error("GATE FAILED: entry.txt does not satisfy every gate.");
    process.exit(1);
  }
  console.log("Gate passed: entry is valid.");
}

main();
