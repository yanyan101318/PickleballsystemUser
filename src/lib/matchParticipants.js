/**
 * Normalize participant list from Firestore (supports legacy players + playerNames).
 * @returns {{ uid: string, displayName: string }[]}
 */
export function getParticipants(match) {
  if (Array.isArray(match.participants) && match.participants.length > 0) {
    return match.participants.map((p) => ({
      uid: p.uid,
      displayName: p.displayName || p.name || "Player",
    }));
  }
  const ids = match.players || [];
  const names = match.playerNames || [];
  return ids.map((uid, i) => ({
    uid,
    displayName: names[i] || "Player",
  }));
}
