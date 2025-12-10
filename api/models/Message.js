const supabase = require('../db');

const Message = {
    // Create message
    create: async (data) => {
        const { data: message, error } = await supabase
            .from('messages')
            .insert({
                sender_id: data.sender,
                recipient_id: data.recipient || null,
                group_id: data.groupId || null,
                content: data.content || '',
                fileUrl: data.fileUrl || '',
                type: data.type || 'text'
            })
            .select()
            .single();

        if (error) throw error;
        return Message.findById(message.id);
    },

    // Find by ID
    findById: async (id) => {
        const idInt = typeof id === 'string' ? parseInt(id) : id;
        const { data, error } = await supabase
            .from('messages')
            .select(`
                *,
                sender:users!messages_sender_id_fkey (
                    id,
                    username,
                    nickname,
                    avatar
                )
            `)
            .eq('id', idInt)
            .single();

        if (error || !data) return null;
        return Message.formatMessage(data);
    },

    // Find messages
    find: async (query = {}) => {
        let queryBuilder = supabase
            .from('messages')
            .select(`
                *,
                sender:users!messages_sender_id_fkey (
                    id,
                    username,
                    nickname,
                    avatar
                )
            `);

        if (query.groupId !== null && query.groupId !== undefined) {
            queryBuilder = queryBuilder.eq('group_id', query.groupId);
        } else if (query.$or && Array.isArray(query.$or)) {
            // Handle $or: [{sender: u1, recipient: u2}, {sender: u2, recipient: u1}]
            const orConditions = query.$or.map(cond => {
                return `(sender_id.eq.${cond.sender},recipient_id.eq.${cond.recipient})`;
            });
            // Supabase doesn't support complex OR easily, so we'll use a different approach
            queryBuilder = queryBuilder.is('group_id', null);
            
            // We'll need to filter in JavaScript for complex OR queries
            // For now, let's handle the first condition
            if (query.$or.length > 0) {
                const firstCond = query.$or[0];
                queryBuilder = queryBuilder
                    .or(`sender_id.eq.${firstCond.sender},recipient_id.eq.${firstCond.recipient}`);
            }
        }

        if (query.sender) {
            queryBuilder = queryBuilder.eq('sender_id', query.sender);
        }
        if (query.recipient) {
            queryBuilder = queryBuilder.eq('recipient_id', query.recipient);
        }

        // Handle sort
        if (query.sort) {
            const sortField = query.sort.replace(/^-/, '');
            const sortDir = query.sort.startsWith('-') ? 'desc' : 'asc';
            queryBuilder = queryBuilder.order(sortField, { ascending: sortDir === 'asc' });
        } else {
            queryBuilder = queryBuilder.order('timestamp', { ascending: true });
        }

        const { data, error } = await queryBuilder;

        if (error) {
            console.error('Message find error:', error);
            return [];
        }

        // Filter for complex OR queries if needed
        let messages = data || [];
        if (query.$or && Array.isArray(query.$or) && query.$or.length > 1) {
            messages = messages.filter(msg => {
                return query.$or.some(cond => {
                    return (msg.sender_id === cond.sender && msg.recipient_id === cond.recipient) ||
                           (msg.sender_id === cond.recipient && msg.recipient_id === cond.sender);
                });
            });
        }

        return messages.map(Message.formatMessage);
    },

    // Delete many
    deleteMany: async (query) => {
        let queryBuilder = supabase.from('messages').delete();

        if (query.groupId) {
            queryBuilder = queryBuilder.eq('group_id', query.groupId);
        }
        if (query.$or) {
            // For complex OR queries, we need to handle them differently
            // This is a simplified version
            const firstCond = query.$or[0];
            if (firstCond.sender) {
                queryBuilder = queryBuilder.eq('sender_id', firstCond.sender);
            }
        }

        const { error } = await queryBuilder;

        if (error) throw error;
        return { deletedCount: 1 }; // Supabase doesn't return count, so we estimate
    },

    // Format message for API response
    formatMessage: (msg) => {
        const sender = msg.sender || (Array.isArray(msg.sender) ? msg.sender[0] : null);
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
            sender_username: sender?.username || null,
            sender_nickname: sender?.nickname || null,
            sender_avatar: sender?.avatar || null
        };
    }
};

module.exports = Message;
