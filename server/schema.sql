-- Drop tables if they exist
DROP TABLE IF EXISTS sms_logs CASCADE;
DROP TABLE IF EXISTS receipts CASCADE;
DROP TABLE IF EXISTS sales_transactions CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS customer_orders CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS borrow_records CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS match_participants CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS courts CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS stores CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS admin CASCADE;

-- Create tables
CREATE TABLE users (
    uid VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(50),
    membership VARCHAR(50) DEFAULT 'basic',
    role VARCHAR(50) DEFAULT 'user',
    photo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin (
    uid VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(50),
    role VARCHAR(50) DEFAULT 'admin',
    photo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE courts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'Indoor',
    location VARCHAR(255),
    price_per_hour DECIMAL(10, 2) DEFAULT 0,
    rating DECIMAL(3, 2) DEFAULT 0,
    reviews INTEGER DEFAULT 0,
    max_players INTEGER DEFAULT 4,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    base_status BOOLEAN DEFAULT true,
    available BOOLEAN DEFAULT true,
    amenities JSONB DEFAULT '[]',
    img TEXT,
    active_start_time VARCHAR(10),
    active_end_time VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(uid),
    court_id INTEGER REFERENCES courts(id),
    date DATE NOT NULL,
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    status VARCHAR(50) DEFAULT 'confirmed',
    payment_status VARCHAR(50) DEFAULT 'pending',
    total_price DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255),
    notes TEXT,
    type VARCHAR(50) DEFAULT 'rent',
    price_per_hour DECIMAL(10, 2) DEFAULT 0,
    sale_price DECIMAL(10, 2) DEFAULT 0,
    available_qty INTEGER DEFAULT 0,
    total_qty INTEGER DEFAULT 0,
    overdue_fine_per_hour DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE matches (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    type VARCHAR(50) DEFAULT 'open_play',
    status VARCHAR(50) DEFAULT 'upcoming',
    date_time TIMESTAMP NOT NULL,
    court_id INTEGER REFERENCES courts(id),
    max_players INTEGER DEFAULT 4,
    price_per_player DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE match_participants (
    id SERIAL PRIMARY KEY,
    match_id INTEGER REFERENCES matches(id),
    user_id VARCHAR(255) REFERENCES users(uid),
    status VARCHAR(50) DEFAULT 'joined',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created_by VARCHAR(255) REFERENCES users(uid),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE chats (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(uid) UNIQUE,
    user_name VARCHAR(255),
    last_message TEXT,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    unread_by_admin BOOLEAN DEFAULT false,
    unread_by_customer BOOLEAN DEFAULT false
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER REFERENCES chats(id),
    sender_id VARCHAR(255),
    sender_name VARCHAR(255),
    text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(50) DEFAULT 'booking',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

