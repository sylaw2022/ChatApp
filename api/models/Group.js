const db = require('../db');

const Group = {
    // Create group
    create: (data) => {
        const stmt = db.prepare('INSERT INTO groups (name, admin_id, avatar) VALUES (?, ?, ?)');
        const result = stmt.run(data.name, data.admin, data.avatar || '');
        const groupId = result.lastInsertRowid;

        // Add members
        if (data.members && data.members.length > 0) {
            const memberStmt = db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)');
            const insertMany = db.transaction((members) => {
                for (const memberId of members) {
                    memberStmt.run(groupId, memberId);
                }
            });
            insertMany(data.members);
        }

        return Group.findById(groupId);
    },

    // Find by ID
    findById: (id) => {
        const groupStmt = db.prepare('SELECT * FROM groups WHERE id = ?');
        const group = groupStmt.get(id);
        if (!group) return null;

        // Get members
        const memberStmt = db.prepare(`
            SELECT u.* FROM users u
            INNER JOIN group_members gm ON u.id = gm.user_id
            WHERE gm.group_id = ?
        `);
        const members = memberStmt.all(id);

        // Get admin
        const admin = db.prepare('SELECT * FROM users WHERE id = ?').get(group.admin_id);

        return {
            _id: group.id,
            id: group.id,
            name: group.name,
            avatar: group.avatar,
            admin: admin,
            admin_id: group.admin_id,
            members: members,
            createdAt: group.createdAt
        };
    },

    // Find groups
    find: (query = {}) => {
        let sql = 'SELECT DISTINCT g.* FROM groups g';
        const params = [];

        if (query.members) {
            sql += ' INNER JOIN group_members gm ON g.id = gm.group_id WHERE gm.user_id = ?';
            params.push(query.members);
        } else {
            sql += ' WHERE 1=1';
        }

        const stmt = db.prepare(sql);
        const groups = stmt.all(...params);

        // Populate members and admin for each group
        return groups.map(group => {
            const fullGroup = Group.findById(group.id);
            return {
                _id: fullGroup.id,
                id: fullGroup.id,
                name: fullGroup.name,
                avatar: fullGroup.avatar,
                admin: fullGroup.admin,
                members: fullGroup.members,
                createdAt: fullGroup.createdAt
            };
        });
    },

    // Delete by ID
    findByIdAndDelete: (id) => {
        // Delete will cascade due to foreign keys
        const stmt = db.prepare('DELETE FROM groups WHERE id = ?');
        stmt.run(id);
        return { success: true };
    }
};

module.exports = Group;
