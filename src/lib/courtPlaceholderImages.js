/** Sports / court themed placeholders — random pick per court on each data load. */
export const COURT_PLACEHOLDER_IMAGES = [
  "https://media-cldnry.s-nbcnews.com/image/upload/t_nbcnews-fp-1200-630,f_auto,q_auto:best/newscms/2019_16/2827076/190418-pickleball-stock-ac-537p.jpg",
  "https://www.therapeuticassociates.com/wp-content/uploads/2024/11/Pickleball.jpg",

];

/**
 * Each court gets a random image from the pool. Re-runs when `courts` changes (e.g. new fetch).
 * Firestore `img` is not used here so every visit shows variety from the pool.
 */
export function withRandomCourtImages(courts) {
  if (!Array.isArray(courts) || !courts.length) return [];
  const pool = COURT_PLACEHOLDER_IMAGES;
  return courts.map((c) => ({
    ...c,
    displayImageUrl: pool[Math.floor(Math.random() * pool.length)],
  }));
}
