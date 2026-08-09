/* srs.js — simplified SM-2 spaced repetition scheduling.
   Day-granularity (no time-of-day learning steps) to keep this
   understandable and match how the rest of the app already thinks about
   "due" — a card is due on a given day, not at a specific minute.

   Ease factor bounds and interval multipliers follow the standard SM-2 /
   Anki-style shape: Again resets progress and drops ease, Hard nudges
   interval up gently while dropping ease slightly, Good grows the
   interval by the current ease factor, Easy grows it further and raises
   ease for next time.
*/

const SRS_MIN_EASE = 1.3;
const SRS_MAX_EASE = 3.5;

function scheduleNext(card, rating) {
  let interval = card.interval || 0;
  let easeFactor = card.easeFactor || 2.5;
  let reviewCount = (card.reviewCount || 0) + 1;
  let lapses = card.lapses || 0;

  switch (rating) {
    case 'again':
      lapses += 1;
      interval = 1;
      easeFactor = Math.max(SRS_MIN_EASE, easeFactor - 0.2);
      break;
    case 'hard':
      interval = interval === 0 ? 1 : Math.max(1, Math.round(interval * 1.2));
      easeFactor = Math.max(SRS_MIN_EASE, easeFactor - 0.15);
      break;
    case 'good':
      if (interval === 0) interval = 1;
      else if (interval === 1) interval = 6; // SM-2's standard second-step bootstrap
      else interval = Math.round(interval * easeFactor);
      break;
    case 'easy':
      interval = interval === 0 ? 4 : Math.round(interval * easeFactor * 1.3);
      easeFactor = Math.min(SRS_MAX_EASE, easeFactor + 0.15);
      break;
    default:
      throw new Error(`Unknown rating: ${rating}`);
  }

  const dueDate = Date.now() + interval * 24 * 60 * 60 * 1000;
  return { interval, easeFactor, reviewCount, lapses, dueDate };
}

function formatInterval(days) {
  if (days < 1) return 'today';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.round(days / 30)} mo`;
  return `${(days / 365).toFixed(1)} yr`;
}

/* Preview what each rating WOULD produce, without committing — used to
   show "1d / 3d / 6d / 10d" style labels on the rating buttons. */
function previewIntervals(card) {
  return {
    again: scheduleNext(card, 'again').interval,
    hard: scheduleNext(card, 'hard').interval,
    good: scheduleNext(card, 'good').interval,
    easy: scheduleNext(card, 'easy').interval,
  };
}

window.RecallSRS = { scheduleNext, formatInterval, previewIntervals };
