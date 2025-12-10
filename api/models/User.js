const db = require('../db');

const User = {
    // Create user
    create: (data) => {
        try {
            const stmt = db.prepare(`
                INSERT INTO users (username, password, role, nickname, avatar, isVisible)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            const result = stmt.run(
                data.username,
                data.password,
                data.role || 'user',
                data.nickname || '',
                data.avatar || '',
                data.isVisible !== undefined ? (data.isVisible ? 1 : 0) : 1
            );
            return User.findById(result.lastInsertRowid);
        } catch (error) {
            // Re-throw with proper error code for handling in API
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                const dbError = new Error('Username already exists');
                dbError.code = 'SQLITE_CONSTRAINT_UNIQUE';
                throw dbError;
            }
            throw error;
        }
    },

    // Find by ID
    findById: (id) => {
        const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
        // Convert to integer if it's a string
        const idInt = typeof id === 'string' ? parseInt(id) : id;
        return stmt.get(idInt);
    },

    // Find by username
    findOne: (query) => {
        if (query.username) {
            const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
            return stmt.get(query.username);
        }
        return null;
    },

    // Find all
    find: (query = {}) => {
        let sql = 'SELECT * FROM users';
        const conditions = [];
        const params = [];

        if (query.$or) {
            // Handle $or: [{ isVisible: true }, { isVisible: { $exists: false } }]
            const orConditions = query.$or.map(cond => {
                if (cond.isVisible === true) {
                    conditions.push('isVisible = 1');
                } else if (cond.isVisible && cond.isVisible.$exists === false) {
                    conditions.push('1=1'); // Always true, matches all
                }
                return null;
            });
        } else if (query.isVisible !== undefined) {
            conditions.push('isVisible = ?');
            params.push(query.isVisible ? 1 : 0);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        const stmt = db.prepare(sql);
        return stmt.all(...params);
    },

    // Update by ID
    findByIdAndUpdate: (id, data, options = {}) => {
        // Convert to integer if it's a string
        const idInt = typeof id === 'string' ? parseInt(id) : id;
        const updates = [];
        const params = [];

        if (data.nickname !== undefined) {
            updates.push('nickname = ?');
            params.push(data.nickname);
        }
        if (data.avatar !== undefined) {
            updates.push('avatar = ?');
            params.push(data.avatar);
        }
        if (data.isVisible !== undefined) {
            updates.push('isVisible = ?');
            params.push(data.isVisible ? 1 : 0);
        }
        if (data.$push) {
            // Handle $push for friends/friendRequests
            if (data.$push.friends) {
                const stmt = db.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)');
                stmt.run(id, data.$push.friends);
            }
            if (data.$push.friendRequests) {
                const stmt = db.prepare('INSERT OR IGNORE INTO friend_requests (to_id, from_id) VALUES (?, ?)');
                stmt.run(id, data.$push.friendRequests);
            }
        }
        if (data.$pull) {
            // Handle $pull
            if (data.$pull.friends) {
                const stmt = db.prepare('DELETE FROM friends WHERE user_id = ? AND friend_id = ?');
                stmt.run(id, data.$pull.friends);
            }
            if (data.$pull.friendRequests) {
                const stmt = db.prepare('DELETE FROM friend_requests WHERE to_id = ? AND from_id = ?');
                stmt.run(id, data.$pull.friendRequests);
            }
        }

        if (updates.length > 0) {
            params.push(idInt);
            const stmt = db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`);
            stmt.run(...params);
        }

        // Return the updated user
        const updatedUser = User.findById(idInt);
        return updatedUser || null;
    },

    // Delete by ID
    findByIdAndDelete: (id) => {
        const stmt = db.prepare('DELETE FROM users WHERE id = ?');
        stmt.run(id);
        return { ok: true };
    },

    // Get friends
    getFriends: (userId) => {
        const stmt = db.prepare(`
            SELECT u.* FROM users u
            INNER JOIN friends f ON u.id = f.friend_id
            WHERE f.user_id = ?
        `);
        return stmt.all(userId);
    },

    // Get friend requests
    getFriendRequests: (userId) => {
        const stmt = db.prepare(`
            SELECT u.* FROM users u
            INNER JOIN friend_requests fr ON u.id = fr.from_id
            WHERE fr.to_id = ?
        `);
        return stmt.all(userId);
    },

    // Add friend
    addFriend: (userId, friendId) => {
        const stmt = db.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?), (?, ?)');
        stmt.run(userId, friendId, friendId, userId);
    },

    // Add friend request
    addFriendRequest: (fromId, toId) => {
        const stmt = db.prepare('INSERT OR IGNORE INTO friend_requests (from_id, to_id) VALUES (?, ?)');
        stmt.run(fromId, toId);
    },

    // Remove friend request
    removeFriendRequest: (fromId, toId) => {
        const stmt = db.prepare('DELETE FROM friend_requests WHERE from_id = ? AND to_id = ?');
        stmt.run(fromId, toId);
    },

    // Check if friends
    isFriend: (userId, friendId) => {
        const stmt = db.prepare('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?');
        return stmt.get(userId, friendId) !== undefined;
    },

    // Check if friend request exists
    hasFriendRequest: (fromId, toId) => {
        const stmt = db.prepare('SELECT 1 FROM friend_requests WHERE from_id = ? AND to_id = ?');
        return stmt.get(fromId, toId) !== undefined;
    }
};

module.exports = User;
