const supabase = require('../db');

const User = {
    // Create user
    create: async (data) => {
        try {
            const { data: user, error } = await supabase
                .from('users')
                .insert({
                    username: data.username,
                    password: data.password,
                    role: data.role || 'user',
                    nickname: data.nickname || '',
                    avatar: data.avatar || '',
                    isVisible: data.isVisible !== undefined ? data.isVisible : true
                })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') { // Unique constraint violation
                    const dbError = new Error('Username already exists');
                    dbError.code = 'SQLITE_CONSTRAINT_UNIQUE';
                    throw dbError;
                }
                throw error;
            }

            return user;
        } catch (error) {
            throw error;
        }
    },

    // Find by ID
    findById: async (id) => {
        const idInt = typeof id === 'string' ? parseInt(id) : id;
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', idInt)
            .single();

        if (error || !data) return null;
        return data;
    },

    // Find by username
    findOne: async (query) => {
        if (query.username) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', query.username.trim())
                .single();

            if (error) {
                // PGRST116 means no rows found - this is expected for non-existent users
                if (error.code === 'PGRST116') {
                    return null;
                }
                console.error('User.findOne error:', error);
                return null;
            }
            return data;
        }
        return null;
    },

    // Find all
    find: async (query = {}) => {
        let queryBuilder = supabase.from('users').select('*');

        if (query.$or) {
            // Handle $or: [{ isVisible: true }, { isVisible: { $exists: false } }]
            const orConditions = query.$or.filter(cond => cond.isVisible === true);
            if (orConditions.length > 0) {
                queryBuilder = queryBuilder.eq('isVisible', true);
            } else {
                // If no conditions match, return all
            }
        } else if (query.isVisible !== undefined) {
            queryBuilder = queryBuilder.eq('isVisible', query.isVisible);
        }

        const { data, error } = await queryBuilder;
        if (error) {
            console.error('User find error:', error);
            return [];
        }
        return data || [];
    },

    // Update by ID
    findByIdAndUpdate: async (id, data, options = {}) => {
        const idInt = typeof id === 'string' ? parseInt(id) : id;
        const updateData = {};

        if (data.nickname !== undefined) updateData.nickname = data.nickname;
        if (data.avatar !== undefined) updateData.avatar = data.avatar;
        if (data.isVisible !== undefined) updateData.isVisible = data.isVisible;

        // Handle $push for friends/friendRequests
        if (data.$push) {
            if (data.$push.friends) {
                await supabase.from('friends').insert({
                    user_id: idInt,
                    friend_id: data.$push.friends
                }).then(() => {
                    return supabase.from('friends').insert({
                        user_id: data.$push.friends,
                        friend_id: idInt
                    });
                });
            }
            if (data.$push.friendRequests) {
                await supabase.from('friend_requests').insert({
                    from_id: data.$push.friendRequests,
                    to_id: idInt
                });
            }
        }

        // Handle $pull
        if (data.$pull) {
            if (data.$pull.friends) {
                await supabase.from('friends')
                    .delete()
                    .eq('user_id', idInt)
                    .eq('friend_id', data.$pull.friends);
                await supabase.from('friends')
                    .delete()
                    .eq('user_id', data.$pull.friends)
                    .eq('friend_id', idInt);
            }
            if (data.$pull.friendRequests) {
                await supabase.from('friend_requests')
                    .delete()
                    .eq('from_id', data.$pull.friendRequests)
                    .eq('to_id', idInt);
            }
        }

        if (Object.keys(updateData).length > 0) {
            const { data: updatedUser, error } = await supabase
                .from('users')
                .update(updateData)
                .eq('id', idInt)
                .select()
                .single();

            if (error) throw error;
            return updatedUser;
        }

        return User.findById(idInt);
    },

    // Delete by ID
    findByIdAndDelete: async (id) => {
        const idInt = typeof id === 'string' ? parseInt(id) : id;
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', idInt);

        if (error) throw error;
        return { ok: true };
    },

    // Get friends
    getFriends: async (userId) => {
        const idInt = typeof userId === 'string' ? parseInt(userId) : userId;
        const { data, error } = await supabase
            .from('friends')
            .select(`
                friend_id,
                users!friends_friend_id_fkey (
                    id,
                    username,
                    nickname,
                    avatar,
                    role,
                    isVisible
                )
            `)
            .eq('user_id', idInt);

        if (error) {
            console.error('Get friends error:', error);
            return [];
        }

        // Extract user data from the nested structure
        return data.map(item => item.users).filter(Boolean);
    },

    // Get friend requests
    getFriendRequests: async (userId) => {
        const idInt = typeof userId === 'string' ? parseInt(userId) : userId;
        const { data, error } = await supabase
            .from('friend_requests')
            .select(`
                from_id,
                users!friend_requests_from_id_fkey (
                    id,
                    username,
                    nickname,
                    avatar,
                    role,
                    isVisible
                )
            `)
            .eq('to_id', idInt);

        if (error) {
            console.error('Get friend requests error:', error);
            return [];
        }

        return data.map(item => item.users).filter(Boolean);
    },

    // Add friend
    addFriend: async (userId, friendId) => {
        const userIdInt = typeof userId === 'string' ? parseInt(userId) : userId;
        const friendIdInt = typeof friendId === 'string' ? parseInt(friendId) : friendId;

        // Insert bidirectional friendship
        const { error: error1 } = await supabase
            .from('friends')
            .insert({ user_id: userIdInt, friend_id: friendIdInt });

        const { error: error2 } = await supabase
            .from('friends')
            .insert({ user_id: friendIdInt, friend_id: userIdInt });

        if (error1 || error2) {
            // Ignore duplicate key errors
            if (error1?.code !== '23505' && error2?.code !== '23505') {
                throw error1 || error2;
            }
        }
    },

    // Add friend request
    addFriendRequest: async (fromId, toId) => {
        const fromIdInt = typeof fromId === 'string' ? parseInt(fromId) : fromId;
        const toIdInt = typeof toId === 'string' ? parseInt(toId) : toId;

        const { error } = await supabase
            .from('friend_requests')
            .insert({ from_id: fromIdInt, to_id: toIdInt });

        if (error && error.code !== '23505') { // Ignore duplicate
            throw error;
        }
    },

    // Remove friend request
    removeFriendRequest: async (fromId, toId) => {
        const fromIdInt = typeof fromId === 'string' ? parseInt(fromId) : fromId;
        const toIdInt = typeof toId === 'string' ? parseInt(toId) : toId;

        const { error } = await supabase
            .from('friend_requests')
            .delete()
            .eq('from_id', fromIdInt)
            .eq('to_id', toIdInt);

        if (error) throw error;
    },

    // Check if friends
    isFriend: async (userId, friendId) => {
        const userIdInt = typeof userId === 'string' ? parseInt(userId) : userId;
        const friendIdInt = typeof friendId === 'string' ? parseInt(friendId) : friendId;

        const { data, error } = await supabase
            .from('friends')
            .select('id')
            .eq('user_id', userIdInt)
            .eq('friend_id', friendIdInt)
            .limit(1)
            .single();

        return !error && data !== null;
    },

    // Check if friend request exists
    hasFriendRequest: async (fromId, toId) => {
        const fromIdInt = typeof fromId === 'string' ? parseInt(fromId) : fromId;
        const toIdInt = typeof toId === 'string' ? parseInt(toId) : toId;

        const { data, error } = await supabase
            .from('friend_requests')
            .select('id')
            .eq('from_id', fromIdInt)
            .eq('to_id', toIdInt)
            .limit(1)
            .single();

        return !error && data !== null;
    }
};

module.exports = User;
