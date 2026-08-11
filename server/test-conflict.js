

// We need to bypass JWT auth for a pure unit test of the endpoint,
// or we need a valid JWT. Wait, since the route is protected, we need a valid JWT.
// Let's generate a valid JWT using jsonwebtoken.
import jwt from 'jsonwebtoken';

const token = jwt.sign({ uid: 'usr_test123' }, 'your_super_secret_jwt_key_here', { expiresIn: '1h' });

const payload = {
  occurrences: [{ date: '2026-08-11', timeSlot: '10:00 AM', duration: 2 }],
  selectedCourts: [{ id: 1, name: 'Court A' }],
  equipmentLines: [],
  playerName: 'Test User',
  phone: '1234567890',
  notes: '',
  totalAmount: 100,
  promoCode: '',
  paymentMethod: 'manual',
  paymentRef: '',
  paymentImgUrl: ''
};

async function testConflict() {
  // We fire two requests exactly at the same time to simulate a race condition
  const req1 = fetch('http://localhost:3000/api/bookings/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  
  const req2 = fetch('http://localhost:3000/api/bookings/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  
  const [res1, res2] = await Promise.all([req1, req2]);
  
  console.log('Request 1 Status:', res1.status);
  console.log('Request 1 Body:', await res1.text());
  
  console.log('Request 2 Status:', res2.status);
  console.log('Request 2 Body:', await res2.text());
}

testConflict();
