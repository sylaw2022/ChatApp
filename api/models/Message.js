const db = require('../db');

const Message = {
    // Create message
    create: (data) => {
        const stmt = db.prepare(`
            INSERT INTO messages (sender_id, recipient_id, group_id, content, fileUrl, type)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            data.sender,
            data.recipient || null,
            data.groupId || null,
            data.content || '',
            data.fileUrl || '',
            data.type || 'text'
        );
        return Message.findById(result.lastInsertRowid);
    },

    // Find by ID
    findById: (id) => {
        const stmt = db.prepare(`
            SELECT m.*, 
                   u.username as sender_username, 
                   u.nickname as sender_nickname, 
                   u.avatar as sender_avatar
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.id = ?
        `);
        const msg = stmt.get(id);
        if (msg) {
            return Message.formatMessage(msg);
        }
        return null;
    },

    // Find messages
    find: (query = {}) => {
        let sql = `
            SELECT m.*, 
                   u.username as sender_username, 
                   u.nickname as sender_nickname, 
                   u.avatar as sender_avatar
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (query.groupId !== null && query.groupId !== undefined) {
            sql += ' AND m.group_id = ?';
            params.push(query.groupId);
        } else if (query.$or && Array.isArray(query.$or)) {
            // Handle $or: [{sender: u1, recipient: u2}, {sender: u2, recipient: u1}]
            sql += ' AND m.group_id IS NULL AND (';
            const orConditions = [];
            query.$or.forEach(cond => {
                orConditions.push('(m.sender_id = ? AND m.recipient_id = ?)');
                params.push(cond.sender, cond.recipient);
            });
            sql += orConditions.join(' OR ') + ')';
        }

        if (query.sender) {
            sql += ' AND m.sender_id = ?';
            params.push(query.sender);
        }
        if (query.recipient) {
            sql += ' AND m.recipient_id = ?';
            params.push(query.recipient);
        }

        // Handle sort
        if (query.sort) {
            const sortField = query.sort.replace(/^-/, '');
            const sortDir = query.sort.startsWith('-') ? 'DESC' : 'ASC';
            sql += ` ORDER BY m.${sortField} ${sortDir}`;
        } else {
            sql += ' ORDER BY m.timestamp ASC';
        }

        const stmt = db.prepare(sql);
        const messages = stmt.all(...params);
        return messages.map(Message.formatMessage);
    },

    // Delete many
    deleteMany: (query) => {
        let sql = 'DELETE FROM messages WHERE 1=1';
        const params = [];

        if (query.groupId) {
            sql += ' AND group_id = ?';
            params.push(query.groupId);
        }
        if (query.$or) {
            // Handle $or for sender/recipient
            const conditions = query.$or.map(() => {
                return '(sender_id = ? OR recipient_id = ?)';
            });
            sql += ' AND (' + conditions.join(' OR ') + ')';
            query.$or.forEach(cond => {
                params.push(cond.sender, cond.recipient);
            });
        }

        const stmt = db.prepare(sql);
        const result = stmt.run(...params);
        return { deletedCount: result.changes };
    },

    // Format message for API response
    formatMessage: (msg) => {
        return {
            _id: msg.id,
            id: msg.id,
            sender: msg.sender_id,
            recipient: msg.recipient_id,
            groupId: msg.group_id,
            content: msg.content,
            fileUrl: msg.fileUrl,
            type: msg.type,
            timestamp: msg.timestamp,
            sender_username: msg.sender_username,
            sender_nickname: msg.sender_nickname,
            sender_avatar: msg.sender_avatar
        };
    }
};

module.exports = Message;
