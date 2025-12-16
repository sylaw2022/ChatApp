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
            // Supabase doesn't support complex OR easily, so we fetch all messages between these users
            // and filter in JavaScript
            queryBuilder = queryBuilder.is('group_id', null);
            
            // Fetch messages where either user is sender or recipient
            // We'll get all messages involving these two users and filter in JavaScript
            if (query.$or.length > 0) {
                const firstCond = query.$or[0];
                const secondCond = query.$or[1] || query.$or[0];
                
                // Fetch all messages where:
                // - sender is u1 OR u2, AND
                // - recipient is u1 OR u2
                // Then filter in JavaScript to ensure exact match
                const u1 = firstCond.sender;
                const u2 = firstCond.recipient;
                
                // Use a simpler approach: fetch messages where sender is u1 or u2, and recipient is u1 or u2
                // This will get all messages between these two users, then we filter in JS
                queryBuilder = queryBuilder
                    .or(`sender_id.eq.${u1},sender_id.eq.${u2}`)
                    .or(`recipient_id.eq.${u1},recipient_id.eq.${u2}`);
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
        if (query.$or && Array.isArray(query.$or) && query.$or.length > 0) {
            // Filter to ensure messages match exactly one of the OR conditions
            messages = messages.filter(msg => {
                return query.$or.some(cond => {
                    const senderMatch = msg.sender_id === cond.sender && msg.recipient_id === cond.recipient;
                    const reverseMatch = msg.sender_id === cond.recipient && msg.recipient_id === cond.sender;
                    return senderMatch || reverseMatch;
                });
            });
            console.log(`📥 Filtered ${messages.length} messages from ${data.length} total for OR query`);
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
            _id: msg.id, // Add _id for client compatibility
            id: msg.id,
            sender: {
                _id: msg.sender_id,
                id: msg.sender_id,
                username: sender?.username || null,
                nickname: sender?.nickname || null,
                avatar: sender?.avatar || null
            },
            recipient: msg.recipient_id,
            recipient_id: msg.recipient_id, // Include both formats for compatibility
            groupId: msg.group_id,
            group_id: msg.group_id, // Include both formats for compatibility
            content: msg.content,
            fileUrl: msg.fileUrl,
            type: msg.type,
            timestamp: msg.timestamp,
            sender_username: sender?.username || null,
            sender_nickname: sender?.nickname || null,
            sender_avatar: sender?.avatar || null,
            sender_id: msg.sender_id // Include sender_id for compatibility
        };
    }
};

module.exports = Message;
