import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../supabaseClient";

type Report = {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  context: string | null;
  status: string;
  created_at: string;
};

type ReportWithUsers = Report & {
  reporter_name?: string;
  reported_name?: string;
};

export default function AdminReportsScreen() {
  const router = useRouter();
  const [reports, setReports] = useState<ReportWithUsers[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data: authUser, error } = await supabase
        .from("auth.users")
        .select("is_super_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      } else {
        setIsAdmin(authUser?.is_super_admin === true);
      }

      if (authUser?.is_super_admin === true) {
        await loadReports();
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Failed to check admin status:", error);
      setIsAdmin(false);
      setLoading(false);
    }
  };

  const loadReports = async () => {
    try {
      setLoading(true);

      const { data: reportsData, error: reportsError } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (reportsError) {
        console.error("Error loading reports:", reportsError);
        Alert.alert("Error", "Failed to load reports");
        return;
      }

      if (!reportsData || reportsData.length === 0) {
        setReports([]);
        return;
      }

      const userIds = [
        ...new Set([
          ...reportsData.map((r) => r.reporter_id),
          ...reportsData.map((r) => r.reported_id),
        ]),
      ];

      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, name")
        .in("id", userIds);

      if (usersError) {
        console.warn("Error loading user names:", usersError);
      }

      const userMap = new Map<string, string>();
      if (usersData) {
        usersData.forEach((user) => {
          userMap.set(user.id, user.name || "Unknown User");
        });
      }

      const enrichedReports = reportsData.map((report) => ({
        ...report,
        reporter_name: userMap.get(report.reporter_id) || "Unknown",
        reported_name: userMap.get(report.reported_id) || "Unknown",
      }));

      setReports(enrichedReports);
    } catch (error) {
      console.error("Failed to load reports:", error);
      Alert.alert("Error", "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatReason = (reason: string) => {
    return reason
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const renderReport = ({ item }: { item: ReportWithUsers }) => (
    <View style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <Text style={styles.reportId}>Report #{item.id.slice(0, 8)}</Text>
        <View
          style={[
            styles.statusBadge,
            item.status === "pending"
              ? styles.statusPending
              : item.status === "resolved"
              ? styles.statusResolved
              : styles.statusRejected,
          ]}
        >
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.reportRow}>
        <Text style={styles.label}>Reporter:</Text>
        <Text style={styles.value}>{item.reporter_name}</Text>
      </View>

      <View style={styles.reportRow}>
        <Text style={styles.label}>Reported User:</Text>
        <Text style={styles.value}>{item.reported_name}</Text>
      </View>

      <View style={styles.reportRow}>
        <Text style={styles.label}>Reason:</Text>
        <Text style={styles.value}>{formatReason(item.reason)}</Text>
      </View>

      {item.context && (
        <View style={styles.reportRow}>
          <Text style={styles.label}>Context:</Text>
          <Text style={styles.valueContext}>{item.context}</Text>
        </View>
      )}

      <View style={styles.reportRow}>
        <Text style={styles.label}>Date:</Text>
        <Text style={styles.value}>{formatDate(item.created_at)}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.header}>Admin Reports</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00FF7F" />
        </View>
      </View>
    );
  }

  if (isAdmin === false) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.header}>Admin Reports</Text>
        </View>
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedText}>Access Denied</Text>
          <Text style={styles.accessDeniedSubtext}>
            You do not have permission to view this page.
          </Text>
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
        <Text style={styles.header}>Admin Reports</Text>
      </View>

      <View style={styles.statsRow}>
        <Text style={styles.statsText}>Total Reports: {reports.length}</Text>
        <TouchableOpacity onPress={loadReports} style={styles.refreshButton}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={reports}
        renderItem={renderReport}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No reports found</Text>
        }
      />
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
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statsText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  refreshButton: {
    backgroundColor: "#1f1f1f",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  refreshText: {
    color: "#00FF7F",
    fontSize: 14,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    paddingBottom: 20,
  },
  reportCard: {
    backgroundColor: "#1f1f1f",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2f2f2f",
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2f2f2f",
  },
  reportId: {
    color: "#00FF7F",
    fontSize: 14,
    fontWeight: "bold",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: "rgba(255, 193, 7, 0.2)",
  },
  statusResolved: {
    backgroundColor: "rgba(76, 175, 80, 0.2)",
  },
  statusRejected: {
    backgroundColor: "rgba(244, 67, 54, 0.2)",
  },
  statusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  reportRow: {
    marginBottom: 8,
  },
  label: {
    color: "#888",
    fontSize: 13,
    marginBottom: 2,
  },
  value: {
    color: "#fff",
    fontSize: 15,
  },
  valueContext: {
    color: "#ccc",
    fontSize: 14,
    fontStyle: "italic",
  },
  emptyText: {
    color: "#888",
    fontSize: 16,
    textAlign: "center",
    marginTop: 40,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  accessDeniedText: {
    color: "#ff5555",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 12,
  },
  accessDeniedSubtext: {
    color: "#888",
    fontSize: 16,
    textAlign: "center",
  },
});
