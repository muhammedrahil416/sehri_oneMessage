'use strict';

/**
 * pollPhase.js — Single source of truth for poll timing logic.
 *
 * Every controller that needs to know "what phase is the poll in right now?"
 * must use getPollPhase() from this file. No controller should re-implement
 * time comparisons independently.
 *
 * ⚠️  SHARED UTILITY — changes to WINDOWS or getPollPhase behavior affect
 *     both Person 1 (voting flow) and Person 2 (special cases / toggle).
 *     Any modification to this file must be reviewed by both before merging.
 *
 * Daily schedule (all times IST, Asia/Kolkata):
 * ┌─────────────────────────────────────────────────────────────┐
 * │  22:00 (10 PM)  →  Poll opens. Voting begins.              │
 * │  09:50 (9:50AM) →  Reminder notification sent (cron only)  │
 * │  10:00 (10 AM)  →  Voting closes. Kitchen prepares food.   │
 * │  10:00 – 17:00  →  Special case window. Users can opt-in   │
 * │                    or opt-out if their plans changed.       │
 * │  17:00 – 18:00  →  Allotment window. Super admin reviews   │
 * │                    and approves/rejects special cases.      │
 * │  18:00 – 22:00  →  Status window. Final list visible to    │
 * │                    all. No changes allowed.                 │
 * │  22:00          →  Next day's poll opens. Cycle repeats.   │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Manual override (is_active flag):
 *   `is_active` controls the voting phase only. The rest of the day
 *   (special cases, allotment, status) always runs on the automatic clock.
 *
 *   Concretely:
 *   • Super admin closes voting early (sets is_active=false at e.g. 23:00):
 *     → phase returns CLOSED during the remaining voting window
 *     → at 10:00 AM the clock takes over and phase becomes SPECIAL_CASE
 *     → special cases, allotment, and status still happen on schedule
 *
 *   • Super admin extends voting (sets is_active=true at e.g. 11:00 AM):
 *     → phase returns VOTING even though the clock says special_case
 *     → special case / allotment windows are effectively delayed until
 *       the super admin closes voting again or the next natural phase begins
 *
 *   `deadline_time` is a timestamp set to the moment the super admin toggled
 *   the poll. It is stored for audit/display purposes only — it is NOT read
 *   back by getPollPhase(). Phase logic uses is_active + the IST clock.
 *   If you ever need to use deadline_time for phase computation, discuss with
 *   both Person 1 and Person 2 first.
 */

// ---------------------------------------------------------------------------
// Phase constants — import these in controllers, never use raw strings.
// ---------------------------------------------------------------------------
const PHASES = Object.freeze({
  VOTING: 'voting',             // 22:00 – 10:00  Users vote yes/no
  SPECIAL_CASE: 'special_case', // 10:00 – 17:00  Users raise special cases
  ALLOTMENT: 'allotment',       // 17:00 – 18:00  Super admin reviews special cases
  STATUS: 'status',             // 18:00 – 22:00  Read-only results visible
  CLOSED: 'closed',             // Poll does not exist or voting force-closed
});

// ---------------------------------------------------------------------------
// Window boundaries — IST hours in 24h format.
// Change here only; never put these numbers directly in controllers.
// ---------------------------------------------------------------------------
const WINDOWS = Object.freeze({
  VOTING_OPEN_HOUR: 22,        // 10:00 PM — voting begins
  VOTING_CLOSE_HOUR: 10,       // 10:00 AM — voting ends
  SPECIAL_CASE_CLOSE_HOUR: 17, //  5:00 PM — special case window closes
  ALLOTMENT_CLOSE_HOUR: 18,    //  6:00 PM — allotment window closes
  // STATUS:  18:00 → 22:00 (derived, no explicit constant needed)
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns the current hour (0–23) in IST (Asia/Kolkata).
 *
 * Implementation note: we use Intl.DateTimeFormat instead of toLocaleString
 * because the 'hour12: false' option in toLocaleString returns "24" at
 * midnight in some Node/V8 versions rather than "0", which would silently
 * break the voting-window check. Intl.DateTimeFormat with hour12:false
 * consistently returns 0–23 across all supported Node versions (≥12).
 */
const getISTHour = () => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    hour12: false,
  });
  // formatter.format() returns e.g. "22", "09", "00" — always numeric string.
  const hourStr = formatter.format(new Date());
  const hour = parseInt(hourStr, 10);
  // Defensive guard: if parsing fails for any reason, throw clearly rather
  // than returning NaN which would silently pass every comparison.
  if (Number.isNaN(hour)) {
    throw new Error(`pollPhase: getISTHour() could not parse IST hour from "${hourStr}"`);
  }
  return hour;
};

/**
 * Returns the current UTC Date for use as a timestamp value (e.g. storing
 * special_case_at, deadline_time). MySQL stores timestamps as UTC; Sequelize
 * and MySQL handle the IST ↔ UTC conversion transparently on read/write.
 *
 * Do NOT add an IST offset manually here — that would double-convert.
 * Use this purely to get a consistent "now" reference in controllers instead
 * of calling new Date() directly in multiple places.
 */
const getNow = () => new Date();

// ---------------------------------------------------------------------------
// Core export
// ---------------------------------------------------------------------------

/**
 * Determines the current phase of a poll.
 *
 * @param {object|null} poll — Sequelize Poll instance or plain object with
 *                             { is_active: boolean } fields, or null if no
 *                             poll record exists for today.
 * @returns {string}         — One of the PHASES constants.
 *
 * Decision tree:
 *  1. No poll record                                  → CLOSED
 *  2. is_active=false AND inside voting window        → CLOSED
 *     (super admin force-closed voting)
 *  3. is_active=true  AND outside voting window       → VOTING
 *     (super admin extended voting past 10 AM)
 *  4. Normal path: derive phase from IST clock alone.
 */
const getPollPhase = (poll) => {
  if (!poll) return PHASES.CLOSED;

  const hour = getISTHour();

  // Voting window spans midnight: 22:00–23:59 and 00:00–09:59.
  const inVotingWindow =
    hour >= WINDOWS.VOTING_OPEN_HOUR || hour < WINDOWS.VOTING_CLOSE_HOUR;

  // Override: super admin force-closed voting while inside the window.
  if (!poll.is_active && inVotingWindow) return PHASES.CLOSED;

  // Override: super admin extended voting past the normal close time.
  if (poll.is_active && !inVotingWindow) return PHASES.VOTING;

  // Normal automatic schedule.
  if (inVotingWindow)                               return PHASES.VOTING;
  if (hour < WINDOWS.SPECIAL_CASE_CLOSE_HOUR)      return PHASES.SPECIAL_CASE;
  if (hour < WINDOWS.ALLOTMENT_CLOSE_HOUR)          return PHASES.ALLOTMENT;
  return PHASES.STATUS;
};

// ---------------------------------------------------------------------------
// Convenience wrappers — use these in controllers, not raw PHASES comparisons.
// ---------------------------------------------------------------------------

/** True when users may submit yes/no votes. */
const isVotingOpen = (poll) => getPollPhase(poll) === PHASES.VOTING;

/** True when users may raise or undo special cases. */
const isSpecialCaseWindowOpen = (poll) => getPollPhase(poll) === PHASES.SPECIAL_CASE;

/** True when the super admin may approve/reject special cases. */
const isAllotmentWindowOpen = (poll) => getPollPhase(poll) === PHASES.ALLOTMENT;

module.exports = {
  PHASES,
  WINDOWS,
  getPollPhase,
  isVotingOpen,
  isSpecialCaseWindowOpen,
  isAllotmentWindowOpen,
  getNow,
};
