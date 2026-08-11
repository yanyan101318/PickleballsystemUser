import jwt from 'jsonwebtoken';

const token = jwt.sign({ uid: 'usr_test123' }, 'your_super_secret_jwt_key_here', { expiresIn: '1h' });

const payload = {
  occurrences: [{ date: '2026-08-11', timeSlot: '11:00 AM', duration: 1 }],
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

async function testOverlap() {
  const req1 = await fetch('http://localhost:3000/api/bookings/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  
  console.log('Status:', req1.status);
  console.log('Body:', await req1.text());
}

testOverlap();
