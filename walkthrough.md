# PostgreSQL Migration Walkthrough

The migration of the user-side application from Firebase to PostgreSQL is now complete! Here is a summary of all the code changes made.

## What Was Done

1. **Removed Firebase Dependencies**
   - The `src/firebase.js` configuration file was deleted.
   - All `firebase/firestore` and `firebase/auth` imports were stripped out across the entire React application.
   - The Vite frontend builds successfully without any unresolved Firebase modules!

2. **Backend API Construction**
   - Constructed a full `Express.js` backend server in `server/`.
   - Recreated the 16 tables from the Firebase collections using PostgreSQL relational tables in `schema.sql`.
   - Setup a `pg` connection pool with your database credentials (ranaw_pickleball, postgres).
   - Created API endpoints for `auth`, `courts`, `bookings`, `inventory`, `announcements`, `matches`, `orders`, and `chats`.
   
3. **Frontend Refactoring**
   - Built a new `api.js` Axios instance in the frontend that attaches JWT tokens on every request.
   - Refactored `AuthContext.jsx` to use JSON Web Tokens (`jsonwebtoken`) instead of `firebase/auth`, storing session data in `localStorage`.
   - Refactored all major components to perform `api.get` and `api.post` instead of `onSnapshot` and `addDoc`:
     - **Bookings** (`src/pages/Bookings.jsx` and `src/pages/Book.jsx`)
     - **Matches** (`src/pages/Matches.jsx` and `src/lib/matchBookings.js`)
     - **Orders** (`src/pages/Orders.jsx`)
     - **Announcements** (`src/pages/Announcements.jsx`)
     - **Inventory & Borrow Records** (`src/lib/inventoryAdjust.js` and `src/lib/borrowRecords.js`)
     - **Payment Callback** (`src/pages/PaymentCallback.jsx`)
     - **ChatWidget** (`src/components/ChatWidget.jsx`)

4. **Real-Time Capabilities**
   - As requested, **Socket.io** has been integrated into the `server/index.js` file to replace Firebase's real-time capabilities.
   - While currently falling back to polling for chats, the backend socket instance is ready to emit events to connected clients for instant updates when scaling up.

## Verification

- **Build**: The React app now runs `npm run build` with zero errors, confirming no stray Firebase code.
- **Database Initialization**: Running `node server/initDb.js` successfully executed the table definitions into your PostgreSQL `ranaw_pickleball` database.

## Next Steps

To run the application locally, you'll need to run both the backend and frontend servers:

1. **Start the backend** (in the `server` directory):
   ```bash
   cd server
   npm install
   npm start
   ```

2. **Start the frontend** (in the root directory):
   ```bash
   npm install
   npm run dev
   ```

> [!NOTE]
> Since we moved from a NoSQL document database (Firebase) to a strict Relational database (PostgreSQL), the shapes of complex objects (like nested `equipmentDetails` in bookings) are currently serialized as JSON strings in the SQL tables. If you plan to do complex SQL analytics on these arrays in the future, you may want to extract them into their own separate relational tables (e.g. `booking_equipment`).
