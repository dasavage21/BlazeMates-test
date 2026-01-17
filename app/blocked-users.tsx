import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../supabaseClient";

interface BlockedUser {
  id: string;
  blocked_id: string;
  blocked_at: string;
  user_name: string;
  avatar_url: string | null;
}

export default function BlockedUsersScreen() {
  const router = useRouter();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  const loadBlockedUsers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from("blocks")
        .select(`
          id,
          blocked_id,
          blocked_at,
          users!blocks_blocked_id_fkey (
            user_name,
            avatar_url
          )
        `)
        .eq("blocker_id", user.id)
        .order("blocked_at", { ascending: false });

      if (error) {
        console.error("Error loading blocked users:", error);
        return;
      }

      const formattedData = data?.map((block: any) => ({
        id: block.id,
        blocked_id: block.blocked_id,
        blocked_at: block.blocked_at,
        user_name: block.users?.user_name || "Unknown User",
        avatar_url: block.users?.avatar_url || null,
      })) || [];

      setBlockedUsers(formattedData);
    } catch (error) {
      console.error("Error loading blocked users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (blockId: string, userName: string) => {
    const confirmUnblock = async () => {
      try {
        const { error } = await supabase
          .from("blocks")
          .delete()
          .eq("id", blockId);

        if (error) {
          console.error("Error unblocking user:", error);
          if (Platform.OS === 'web') {
            alert("Failed to unblock user");
          } else {
            Alert.alert("Error", "Failed to unblock user");
          }
          return;
        }

        setBlockedUsers(prev => prev.filter(user => user.id !== blockId));

        if (Platform.OS === 'web') {
          alert(`You have unblocked ${userName}`);
        } else {
          Alert.alert("Success", `You have unblocked ${userName}`);
        }
      } catch (error) {
        console.error("Error unblocking user:", error);
        if (Platform.OS === 'web') {
          alert("An unexpected error occurred");
        } else {
          Alert.alert("Error", "An unexpected error occurred");
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Unblock ${userName}? You will see their posts again.`)) {
        await confirmUnblock();
      }
    } else {
      Alert.alert(
        "Unblock User",
        `Unblock ${userName}? You will see their posts again.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unblock",
            onPress: confirmUnblock,
          },
        ]
      );
    }
  };

  const renderBlockedUser = ({ item }: { item: BlockedUser }) => {
    const blockedDate = new Date(item.blocked_at);
    const formattedDate = blockedDate.toLocaleDateString();

    return (
      <View style={styles.userCard}>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.user_name}</Text>
          <Text style={styles.blockedDate}>Blocked on {formattedDate}</Text>
        </View>
        <TouchableOpacity
          style={styles.unblockButton}
          onPress={() => handleUnblock(item.id, item.user_name)}
        >
          <Text style={styles.unblockText}>Unblock</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.header}>Blocked Users</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00FF7F" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Blocked Users</Text>
      </View>

      {blockedUsers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>You haven't blocked anyone</Text>
          <Text style={styles.emptySubtext}>
            Blocked users won't be able to see your posts and you won't see theirs
          </Text>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          renderItem={renderBlockedUser}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  backButton: {
    marginRight: 12,
  },
  backText: {
    color: "#00FF7F",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    fontSize: 26,
    color: "#00FF7F",
    fontWeight: "bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    paddingBottom: 20,
  },
  userCard: {
    backgroundColor: "#1f1f1f",
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  blockedDate: {
    color: "#888",
    fontSize: 12,
  },
  unblockButton: {
    backgroundColor: "#00FF7F",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  unblockText: {
    color: "#121212",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtext: {
    color: "#888",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
