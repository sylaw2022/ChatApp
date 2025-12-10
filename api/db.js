const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Determine database path
// For Vercel, use /tmp (writable directory in serverless functions)
// Note: Data will be lost on each deployment, SQLite is not ideal for Vercel
const isVercel = process.env.VERCEL === '1';
const dbPath = process.env.DATABASE_PATH || (
    isVercel 
        ? '/tmp/chat.db' 
        : path.join(__dirname, '../data', 'chat.db')
);

// Ensure data directory exists (only for local)
if (!isVercel) {
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

// Initialize database with error handling
let db;
try {
    db = new Database(dbPath);
    console.log(`SQLite database opened at: ${dbPath}`);
} catch (error) {
    console.error('Failed to open SQLite database:', error);
    // Create a mock db object to prevent crashes
    // Note: This won't work, but prevents immediate crash
    db = {
        prepare: () => ({ run: () => ({ lastInsertRowid: 0 }), get: () => null, all: () => [] }),
        exec: () => {},
        pragma: () => {}
    };
    console.warn('Using mock database - SQLite initialization failed. This will not work properly.');
}

// Enable foreign keys (only if db is valid)
if (db && typeof db.pragma === 'function') {
    try {
        db.pragma('foreign_keys = ON');
    } catch (e) {
        console.error('Failed to enable foreign keys:', e);
    }
}

// Initialize tables
function initDatabase() {
    // Users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
            nickname TEXT DEFAULT '',
            avatar TEXT DEFAULT '',
            isVisible INTEGER DEFAULT 1,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Friends junction table
    db.exec(`
        CREATE TABLE IF NOT EXISTS friends (
            user_id INTEGER NOT NULL,
            friend_id INTEGER NOT NULL,
            PRIMARY KEY (user_id, friend_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Friend requests table
    db.exec(`
        CREATE TABLE IF NOT EXISTS friend_requests (
            from_id INTEGER NOT NULL,
            to_id INTEGER NOT NULL,
            PRIMARY KEY (from_id, to_id),
            FOREIGN KEY (from_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (to_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Groups table
    db.exec(`
        CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            avatar TEXT DEFAULT '',
            admin_id INTEGER NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Group members junction table
    db.exec(`
        CREATE TABLE IF NOT EXISTS group_members (
            group_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            PRIMARY KEY (group_id, user_id),
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Messages table
    db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            recipient_id INTEGER,
            group_id INTEGER,
            content TEXT,
            fileUrl TEXT,
            type TEXT DEFAULT 'text' CHECK(type IN ('text', 'image', 'audio', 'video')),
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
            CHECK((recipient_id IS NOT NULL AND group_id IS NULL) OR (recipient_id IS NULL AND group_id IS NOT NULL))
        )
    `);

    // Create indexes
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
        CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
        CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id);
        CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    `);

    console.log('SQLite database initialized successfully');
}

// Initialize on load with error handling
try {
    if (db && typeof db.exec === 'function') {
        initDatabase();
    } else {
        console.warn('Database not available, skipping initialization');
    }
} catch (error) {
    console.error('Database initialization failed:', error);
    // Don't throw - let routes handle the error
}

module.exports = db;

