import api from "../api";

export async function fetchUpcomingOpenPlays({ from = new Date(), limit } = {}) {
  const { data } = await api.get('/matches/open-plays');
  // the backend already filters out past dates, we could implement limit if needed
  return limit ? data.slice(0, limit) : data;
}

export async function fetchOpenPlayById(id) {
  if (!id) return null;
  const { data } = await api.get(`/matches/${id}`);
  return data;
}
