import api from "../api";

export async function fetchBookingsCount() {
  const { data } = await api.get('/bookings/count');
  return data.count;
}

export async function fetchMyBookings() {
  const { data } = await api.get('/bookings/my-bookings');
  return data;
}

export async function createBooking(bookingData) {
  const { data } = await api.post('/bookings', bookingData);
  return data;
}
