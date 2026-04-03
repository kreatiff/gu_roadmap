/**
 * Scoring Multipliers for Strategic Priority
 */
const PRIORITY_MULTIPLIER_MAP = {
  Low: 0.5,
  Medium: 1.0,
  High: 1.5,
  Critical: 2.0,
};

/**
 * Calculates the Gravity Score for a single feature.
 *
 * Formula:
 * votes_norm = (vote_count / maxVotes) * 5
 * raw_score = (votes_norm * impact * priority_multiplier) / effort
 * gravity_score = ceil((raw_score / 50) * 100)
 *
 * @param {Object} feature - The feature object from DB
 * @param {number} maxVotes - The current maximum vote count across all features
 * @returns {number} - The calculated gravity score (0-100)
 */
export function calculateGravityScore(feature, maxVotes) {
  const votes = feature.vote_count || 0;
  const impact = feature.impact ?? 3; // default to mid-range
  const effort = feature.effort > 0 ? feature.effort : 1; // guard against division by zero
  const multiplier = PRIORITY_MULTIPLIER_MAP[feature.priority] ?? 1.0;

  // Normalize votes to 0-5 scale relative to maxVotes
  const votesNorm =
    maxVotes > 0 ? (Math.sqrt(votes) / Math.sqrt(maxVotes)) * 5 : 0;

  // Calculate raw score (max theoretical is 5*5*2.0 / 1 = 50)
  const rawScore = (votesNorm * impact * multiplier) / effort;

  // Map 0-50 range to 0-100 and round up
  const score = Math.ceil((rawScore / 50) * 100);

  // Clamp to 100
  return Math.min(score, 100);
}

/**
 * Recalculates gravity_score for all features in the database.
 *
 * @param {Object} db - better-sqlite3 database instance
 */
export function recalculateAllGravityScores(db) {
  try {
    // 1. Get max votes
    const { maxVotes } = db
      .prepare("SELECT MAX(vote_count) as maxVotes FROM features")
      .get();

    // 2. Get all features with relevant scoring fields
    const features = db
      .prepare("SELECT id, vote_count, impact, effort, priority FROM features")
      .all();

    // 3. Batch update in a transaction
    const updateStmt = db.prepare(`
      UPDATE features 
      SET gravity_score = ?, updated_at = ? 
      WHERE id = ?
    `);

    const now = new Date().toISOString();

    const transaction = db.transaction((featuresList) => {
      for (const feature of featuresList) {
        const score = calculateGravityScore(feature, maxVotes);
        updateStmt.run(score, now, feature.id);
      }
    });

    transaction(features);

    // console.log(`Successfully recalculated gravity scores for ${features.length} features.`);
  } catch (error) {
    console.error("Error recalculating gravity scores:", error);
  }
}
