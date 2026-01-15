// © 2025 Benjamin Hawk. All rights reserved.

import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { supabase } from "../supabaseClient";
import { updateUserActivity } from "../lib/activityTracker";

type Group = {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  created_by: string;
  member_count: number;
  is_public: boolean;
  is_member: boolean;
};

export default function GroupsScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadGroups = useCallback(async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      console.log("Loading groups for user:", userId);
      if (!userId) {
        console.log("No user ID, stopping load");
        setLoading(false);
        return;
      }
      setCurrentUserId(userId);

      const { data: groupsData, error } = await supabase
        .from("group_chats")
        .select("*")
        .eq("is_public", true)
        .order("created_at", { ascending: false });

      console.log("Groups query result:", { groupsData, error });

      if (error) {
        console.error("Error loading groups:", error);
        Alert.alert("Error", `Failed to load groups: ${error.message}`);
        setLoading(false);
        return;
      }

      const { data: membershipsData } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", userId);

      const memberGroupIds = new Set(membershipsData?.map((m) => m.group_id) || []);

      const groupsWithCounts = await Promise.all(
        (groupsData || []).map(async (group) => {
          const { count } = await supabase
            .from("group_members")
            .select("*", { count: "exact", head: true })
            .eq("group_id", group.id);

          return {
            id: group.id,
            name: group.name,
            description: group.description || "",
            image_url: group.image_url,
            created_by: group.created_by,
            member_count: count || 0,
            is_public: group.is_public,
            is_member: memberGroupIds.has(group.id),
          };
        })
      );

      setGroups(groupsWithCounts);
    } catch (error) {
      console.error("Error loading groups:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
    updateUserActivity();

    // Subscribe to auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      console.log("Auth state changed, reloading groups");
      loadGroups();
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [loadGroups]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadGroups();
    setRefreshing(false);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert("Error", "Please enter a group name");
      return;
    }

    setCreating(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        Alert.alert("Error", "You must be logged in");
        return;
      }

      const { data: newGroup, error: createError } = await supabase
        .from("group_chats")
        .insert({
          name: newGroupName.trim(),
          description: newGroupDescription.trim(),
          created_by: userId,
          is_public: true,
        })
        .select()
        .single();

      if (createError || !newGroup) {
        console.error("Error creating group:", createError);
        Alert.alert("Error", "Failed to create group");
        return;
      }

      const { error: memberError } = await supabase
        .from("group_members")
        .insert({
          group_id: newGroup.id,
          user_id: userId,
          role: "admin",
        });

      if (memberError) {
        console.error("Error adding creator as admin:", memberError);
      }

      setShowCreateModal(false);
      setNewGroupName("");
      setNewGroupDescription("");
      loadGroups();
      Alert.alert("Success", "Group created successfully!");
    } catch (error) {
      console.error("Error creating group:", error);
      Alert.alert("Error", "Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGroup = async (groupId: string) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) return;

      const { error } = await supabase
        .from("group_members")
        .insert({
          group_id: groupId,
          user_id: userId,
          role: "member",
        });

      if (error) {
        console.error("Error joining group:", error);
        Alert.alert("Error", "Failed to join group");
        return;
      }

      loadGroups();
      Alert.alert("Success", "Joined group!");
    } catch (error) {
      console.error("Error joining group:", error);
    }
  };

  const handleLeaveGroup = async (groupId: string) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) return;

      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", userId);

      if (error) {
        console.error("Error leaving group:", error);
        Alert.alert("Error", "Failed to leave group");
        return;
      }

      loadGroups();
      Alert.alert("Success", "Left group");
    } catch (error) {
      console.error("Error leaving group:", error);
    }
  };

  const handleOpenGroup = (groupId: string, isMember: boolean) => {
    if (!isMember) {
      Alert.alert("Join Group", "You need to join this group to view messages", [
        { text: "Cancel", style: "cancel" },
        { text: "Join", onPress: () => handleJoinGroup(groupId) },
      ]);
      return;
    }
    router.push({ pathname: "/group-chat", params: { groupId } });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00FF7F" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Community Groups</Text>
        <TouchableOpacity onPress={() => setShowCreateModal(true)} style={styles.createButton}>
          <Text style={styles.createButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {groups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No groups yet. Create the first one!</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.groupCard}
              onPress={() => handleOpenGroup(item.id, item.is_member)}
            >
              <View style={styles.groupImageContainer}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.groupImage} />
                ) : (
                  <View style={[styles.groupImage, styles.groupImagePlaceholder]}>
                    <Text style={styles.groupImagePlaceholderText}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.groupInfo}>
                <Text style={styles.groupName}>{item.name}</Text>
                {item.description && (
                  <Text style={styles.groupDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}
                <Text style={styles.groupMemberCount}>
                  {item.member_count} {item.member_count === 1 ? "member" : "members"}
                </Text>
              </View>
              <View style={styles.groupActions}>
                {item.is_member ? (
                  <>
                    <TouchableOpacity
                      style={styles.openButton}
                      onPress={() => router.push({ pathname: "/group-chat", params: { groupId: item.id } })}
                    >
                      <Text style={styles.openButtonText}>Open</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.leaveButton}
                      onPress={() => handleLeaveGroup(item.id)}
                    >
                      <Text style={styles.leaveButtonText}>Leave</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.joinButton}
                    onPress={() => handleJoinGroup(item.id)}
                  >
                    <Text style={styles.joinButtonText}>Join</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Group</Text>
            <TextInput
              style={styles.input}
              placeholder="Group Name"
              placeholderTextColor="#888"
              value={newGroupName}
              onChangeText={setNewGroupName}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (optional)"
              placeholderTextColor="#888"
              value={newGroupDescription}
              onChangeText={setNewGroupDescription}
              multiline
              numberOfLines={3}
            />
            <View style={styles.comingSoonBox}>
              <Text style={styles.comingSoonTitle}>Private Groups - Coming Soon</Text>
              <Text style={styles.comingSoonDescription}>
                Blaze+ members will be able to create invite-only private groups
              </Text>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowCreateModal(false);
                  setNewGroupName("");
                  setNewGroupDescription("");
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleCreateGroup}
                disabled={creating}
              >
                <Text style={styles.submitButtonText}>
                  {creating ? "Creating..." : "Create"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0f0f0f",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: "#121212",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  backButton: {
    padding: 8,
  },
  backText: {
    color: "#00FF7F",
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  createButton: {
    backgroundColor: "#00FF7F",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: "#121212",
    fontWeight: "bold",
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    color: "#888",
    fontSize: 16,
    textAlign: "center",
  },
  groupCard: {
    backgroundColor: "#1e1e1e",
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  groupImageContainer: {
    width: 60,
    height: 60,
  },
  groupImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  groupImagePlaceholder: {
    backgroundColor: "#00FF7F",
    justifyContent: "center",
    alignItems: "center",
  },
  groupImagePlaceholderText: {
    color: "#121212",
    fontSize: 24,
    fontWeight: "bold",
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  groupDescription: {
    color: "#aaa",
    fontSize: 14,
    marginBottom: 4,
  },
  groupMemberCount: {
    color: "#00FF7F",
    fontSize: 12,
    fontWeight: "600",
  },
  groupActions: {
    gap: 8,
  },
  joinButton: {
    backgroundColor: "#00FF7F",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  joinButtonText: {
    color: "#121212",
    fontWeight: "bold",
    fontSize: 14,
  },
  openButton: {
    backgroundColor: "#00FF7F",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  openButtonText: {
    color: "#121212",
    fontWeight: "bold",
    fontSize: 14,
  },
  leaveButton: {
    backgroundColor: "#ff4444",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  leaveButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#1e1e1e",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#121212",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#333",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#333",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  submitButton: {
    flex: 1,
    backgroundColor: "#00FF7F",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#121212",
    fontWeight: "bold",
    fontSize: 16,
  },
  comingSoonBox: {
    backgroundColor: "#2a2a2a",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  comingSoonTitle: {
    color: "#FFD700",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  comingSoonDescription: {
    color: "#aaa",
    fontSize: 12,
  },
});
