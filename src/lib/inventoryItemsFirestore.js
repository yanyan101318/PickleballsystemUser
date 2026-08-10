import api from "../api";

export async function fetchInventoryItems() {
  const { data } = await api.get('/inventory');
  return data;
}
