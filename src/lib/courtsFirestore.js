import api from "../api";

export async function fetchCourts() {
  const { data } = await api.get('/courts');
  return data;
}

export async function fetchCourtById(id) {
  const { data } = await api.get(`/courts/${id}`);
  return data;
}