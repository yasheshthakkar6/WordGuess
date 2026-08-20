const STATUS_RANK = { absent: 0, present: 1, correct: 2 };
const STATUS_EMOJI = { correct: "\u{1F7E9}", present: "\u{1F7E7}", absent: "⬛" };

// best-known status per letter across every guess so far (green beats orange beats black)
export function buildKeyboardStatus(guesses) {
  const status = {};
  for (const g of guesses) {
    for (let i = 0; i < g.guess_word.length; i++) {
      const letter = g.guess_word[i];
      const s = g.result[i];
      if (!status[letter] || STATUS_RANK[s] > STATUS_RANK[status[letter]]) {
        status[letter] = s;
      }
    }
  }
  return status;
}

// letters confirmed (via letter_counts the API already scopes to guessed letters) to
// appear more than once in the secret word -- safe to badge without revealing anything unguessed
export function buildRepeatedLetters(guesses) {
  const repeated = new Set();
  for (const g of guesses) {
    if (!g.letter_counts) continue;
    for (const [letter, count] of Object.entries(g.letter_counts)) {
      if (count > 1) repeated.add(letter);
    }
  }
  return repeated;
}

export function buildShareText({ modeLabel, mode, wordLength, status, guesses, dateLabel }) {
  // timed mode has unlimited guesses, so "N/6" (implying a 6-try cap) would be
  // misleading there -- it gets its own plain guess count instead
  const scoreLabel =
    mode === "timed"
      ? status === "won"
        ? `${guesses.length} ${guesses.length === 1 ? "guess" : "guesses"}`
        : "unsolved"
      : `${status === "won" ? guesses.length : "X"}/6`;
  const header = `Word Guesser -- ${modeLabel}${dateLabel ? ` (${dateLabel})` : ""} -- ${wordLength} letters -- ${scoreLabel}`;
  const grid = guesses.map((g) => g.result.map((r) => STATUS_EMOJI[r]).join("")).join("\n");
  return `${header}\n\n${grid}`;
}

export async function copyToClipboard(text) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
}

export function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}
