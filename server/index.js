import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import courtsRoutes from './routes/courts.js';
import bookingsRoutes from './routes/bookings.js';
import inventoryRoutes from './routes/inventory.js';
import announcementsRoutes from './routes/announcements.js';
import matchesRoutes from './routes/matches.js'; // Might map to bookings/activity logs
import ordersRoutes from './routes/orders.js';
import chatsRoutes from './routes/chats.js';
import borrowRecordsRoutes from './routes/borrow-records.js';
import notificationsRoutes from './routes/notifications.js';
import pool from './db.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all for dev
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Attach io to req for use in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/courts', courtsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/borrow-records', borrowRecordsRoutes);
app.use('/api/notifications', notificationsRoutes);

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  socket.on('joinChat', (chatId) => {
    socket.join(chatId);
    console.log(`Socket ${socket.id} joined chat ${chatId}`);
  });

  socket.on('joinAdmin', () => {
    socket.join('admin_chats');
    socket.join('admin_notifications');
    console.log(`Socket ${socket.id} joined admin_chats & admin_notifications`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Setup Postgres LISTEN for chat events
const setupListen = async () => {
  try {
    const client = await pool.connect();
    await client.query('LISTEN chat_events');
    
    client.on('notification', (msg) => {
      if (msg.channel === 'chat_events') {
        try {
          const data = JSON.parse(msg.payload);
          if (data.event && data.chatId && data.payload) {
            io.to(data.chatId).emit(data.event, data.payload);
          }
        } catch (e) {
          console.error("Error parsing chat_events payload", e);
        }
      }
    });
    
    console.log("Listening for Postgres chat_events");
  } catch (err) {
    console.error("Postgres listen error:", err);
  }
};
setupListen();

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
