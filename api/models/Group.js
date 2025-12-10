const supabase = require('../db');

const Group = {
    // Create group
    create: async (data) => {
        // Insert group
        const { data: group, error: groupError } = await supabase
            .from('groups')
            .insert({
                name: data.name,
                admin_id: data.admin,
                avatar: data.avatar || ''
            })
            .select()
            .single();

        if (groupError) throw groupError;

        // Add members
        if (data.members && data.members.length > 0) {
            const membersToInsert = data.members.map(memberId => ({
                group_id: group.id,
                user_id: memberId
            }));

            const { error: membersError } = await supabase
                .from('group_members')
                .insert(membersToInsert);

            if (membersError) {
                console.error('Error adding group members:', membersError);
                // Continue anyway
            }
        }

        return Group.findById(group.id);
    },

    // Find by ID
    findById: async (id) => {
        const idInt = typeof id === 'string' ? parseInt(id) : id;

        // Get group with admin
        const { data: group, error: groupError } = await supabase
            .from('groups')
            .select(`
                *,
                admin:users!groups_admin_id_fkey (
                    id,
                    username,
                    nickname,
                    avatar,
                    role
                )
            `)
            .eq('id', idInt)
            .single();

        if (groupError || !group) return null;

        // Get members
        const { data: members, error: membersError } = await supabase
            .from('group_members')
            .select(`
                user_id,
                users!group_members_user_id_fkey (
                    id,
                    username,
                    nickname,
                    avatar,
                    role
                )
            `)
            .eq('group_id', idInt);

        const membersList = members ? members.map(m => m.users).filter(Boolean) : [];

        const admin = Array.isArray(group.admin) ? group.admin[0] : group.admin;
        return {
            _id: group.id, // Add _id for client compatibility
            id: group.id,
            name: group.name,
            avatar: group.avatar || '',
            admin: admin ? {
                _id: admin.id,
                id: admin.id,
                username: admin.username,
                nickname: admin.nickname,
                avatar: admin.avatar
            } : null,
            admin_id: group.admin_id,
            members: membersList.map(m => ({
                _id: m.id,
                id: m.id,
                username: m.username,
                nickname: m.nickname,
                avatar: m.avatar,
                role: m.role
            })),
            createdAt: group.createdAt
        };
    },

    // Find groups
    find: async (query = {}) => {
        let queryBuilder = supabase.from('groups').select('*');

        if (query.members) {
            const memberIdInt = typeof query.members === 'string' ? parseInt(query.members) : query.members;
            // Get groups where user is a member
            const { data: memberGroups, error: memberError } = await supabase
                .from('group_members')
                .select('group_id')
                .eq('user_id', memberIdInt);

            if (memberError) {
                console.error('Error finding member groups:', memberError);
                return [];
            }

            const groupIds = memberGroups.map(mg => mg.group_id);
            if (groupIds.length === 0) return [];

            queryBuilder = queryBuilder.in('id', groupIds);
        }

        const { data: groups, error } = await queryBuilder;

        if (error) {
            console.error('Group find error:', error);
            return [];
        }

        // Populate members and admin for each group
        const populatedGroups = await Promise.all(
            (groups || []).map(group => Group.findById(group.id))
        );

        return populatedGroups.filter(Boolean);
    },

    // Delete by ID
    findByIdAndDelete: async (id) => {
        const idInt = typeof id === 'string' ? parseInt(id) : id;
        const { error } = await supabase
            .from('groups')
            .delete()
            .eq('id', idInt);

        if (error) throw error;
        return { success: true };
    }
};

module.exports = Group;
