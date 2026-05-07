/**
 * Shared Gravity Score Formula
 *
 * Used by both client (optimistic UI) and server (persistent calculation).
 * Keep this in sync with the business rules documented in the project.
 */

const PRIORITY_SCORES = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

/**
 * Calculates the Gravity Score for a single feature.
 *
 * Formula (vote-free, hierarchical):
 *   impactPart   = (impact / 10) * 60   // up to 60 pts
 *   priorityPart = (priority / 4) * 25  // up to 25 pts
 *   effortPart   = ((11 - effort) / 10) * 15  // up to 15 pts (inverse)
 *   gravity_score = ceil(impactPart + priorityPart + effortPart) clamped to 100
 *
 * Hierarchy: Impact (#1) > Priority (#2) > Effort (#3)
 *
 * @param {number} impact   - 1–10 strategic impact score
 * @param {number} effort   - 1–10 development effort score
 * @param {string} priority - Priority label: Low, Medium, High, Critical
 * @returns {number}        - Gravity score 0–100
 */
export function calculateGravityScore(impact, effort, priority) {
  const safeImpact = Math.max(1, Math.min(10, impact ?? 5));
  const safeEffort = Math.max(1, Math.min(10, effort > 0 ? effort : 1));
  const priorityScore = PRIORITY_SCORES[priority] ?? 2;

  const impactPart = (safeImpact / 10) * 60;
  const priorityPart = (priorityScore / 4) * 25;
  const effortPart = ((11 - safeEffort) / 10) * 15;

  return Math.min(Math.ceil(impactPart + priorityPart + effortPart), 100);
}
