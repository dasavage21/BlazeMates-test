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
  ScrollView,
} from "react-native";
import { supabase } from "../supabaseClient";
import { updateUserActivity } from "../lib/activityTracker";

type SmokeSession = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  scheduled_at: string;
  created_by: string;
  attendee_count: number;
  user_rsvp: string | null;
  max_attendees: number | null;
};

export default function EventsScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<SmokeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDescription, setNewEventDescription] = useState("");
  const [newEventLocation, setNewEventLocation] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventTime, setNewEventTime] = useState("");
  const [creating, setCreating] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }
      setCurrentUserId(userId);

      const { data: eventsData, error } = await supabase
        .from("smoke_sessions")
        .select("*")
        .eq("is_public", true)
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true });

      if (error) {
        console.error("Error loading events:", error);
        setLoading(false);
        return;
      }

      const eventsWithCounts = await Promise.all(
        (eventsData || []).map(async (event) => {
          const { count } = await supabase
            .from("session_attendees")
            .select("*", { count: "exact", head: true })
            .eq("session_id", event.id)
            .eq("rsvp_status", "going");

          const { data: rsvpData } = await supabase
            .from("session_attendees")
            .select("rsvp_status")
            .eq("session_id", event.id)
            .eq("user_id", userId)
            .maybeSingle();

          return {
            id: event.id,
            title: event.title,
            description: event.description || "",
            location: event.location,
            scheduled_at: event.scheduled_at,
            created_by: event.created_by,
            attendee_count: count || 0,
            user_rsvp: rsvpData?.rsvp_status || null,
            max_attendees: event.max_attendees,
          };
        })
      );

      setEvents(eventsWithCounts);
    } catch (error) {
      console.error("Error loading events:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
    updateUserActivity();
  }, [loadEvents]);

  const handleCreateEvent = async () => {
    if (!newEventTitle.trim()) {
      Alert.alert("Error", "Please enter an event title");
      return;
    }
    if (!newEventDate.trim() || !newEventTime.trim()) {
      Alert.alert("Error", "Please enter both date and time");
      return;
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(newEventDate)) {
      Alert.alert("Invalid Date", "Please use format: YYYY-MM-DD\nExample: 2026-02-15");
      return;
    }

    // Validate time format (HH:MM in 24h)
    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(newEventTime)) {
      Alert.alert("Invalid Time", "Please use 24-hour format: HH:MM\nExample: 14:30 (for 2:30 PM)\nHours: 00-23, Minutes: 00-59");
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

      const scheduledAt = `${newEventDate}T${newEventTime}:00`;
      const scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        Alert.alert("Error", "Invalid date or time entered");
        return;
      }

      // Check if date is in the past
      if (scheduledDate < new Date()) {
        Alert.alert("Error", "Cannot create events in the past");
        return;
      }

      const { data: newEvent, error: createError } = await supabase
        .from("smoke_sessions")
        .insert({
          title: newEventTitle.trim(),
          description: newEventDescription.trim(),
          location: newEventLocation.trim() || null,
          scheduled_at: scheduledDate.toISOString(),
          created_by: userId,
          is_public: true,
        })
        .select()
        .single();

      if (createError || !newEvent) {
        console.error("Error creating event:", createError);
        Alert.alert("Error", "Failed to create event");
        return;
      }

      await supabase.from("session_attendees").insert({
        session_id: newEvent.id,
        user_id: userId,
        rsvp_status: "going",
      });

      setShowCreateModal(false);
      setNewEventTitle("");
      setNewEventDescription("");
      setNewEventLocation("");
      setNewEventDate("");
      setNewEventTime("");
      loadEvents();
      Alert.alert("Success", "Event created successfully!");
    } catch (error) {
      console.error("Error creating event:", error);
      Alert.alert("Error", "Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  const handleRSVP = async (eventId: string, status: string) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) return;

      const { data: existing } = await supabase
        .from("session_attendees")
        .select("*")
        .eq("session_id", eventId)
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("session_attendees")
          .update({ rsvp_status: status })
          .eq("session_id", eventId)
          .eq("user_id", userId);
      } else {
        await supabase.from("session_attendees").insert({
          session_id: eventId,
          user_id: userId,
          rsvp_status: status,
        });
      }

      loadEvents();
      Alert.alert("Success", `RSVP updated to: ${status}`);
    } catch (error) {
      console.error("Error updating RSVP:", error);
      Alert.alert("Error", "Failed to update RSVP");
    }
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
        <Text style={styles.title}>Smoke Sessions</Text>
        <TouchableOpacity onPress={() => setShowCreateModal(true)} style={styles.createButton}>
          <Text style={styles.createButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {events.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No upcoming sessions. Create the first one!</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const eventDate = new Date(item.scheduled_at);
            const dateStr = eventDate.toLocaleDateString();
            const timeStr = eventDate.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <View style={styles.eventCard}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                {item.description && (
                  <Text style={styles.eventDescription}>{item.description}</Text>
                )}
                <View style={styles.eventDetails}>
                  <Text style={styles.eventDetailText}>📅 {dateStr}</Text>
                  <Text style={styles.eventDetailText}>🕒 {timeStr}</Text>
                  {item.location && (
                    <Text style={styles.eventDetailText}>📍 {item.location}</Text>
                  )}
                  <Text style={styles.eventDetailText}>
                    👥 {item.attendee_count}
                    {item.max_attendees && ` / ${item.max_attendees}`} going
                  </Text>
                </View>

                <View style={styles.rsvpButtons}>
                  <TouchableOpacity
                    style={[
                      styles.rsvpButton,
                      item.user_rsvp === "going" && styles.rsvpButtonActive,
                    ]}
                    onPress={() => handleRSVP(item.id, "going")}
                  >
                    <Text
                      style={[
                        styles.rsvpButtonText,
                        item.user_rsvp === "going" && styles.rsvpButtonTextActive,
                      ]}
                    >
                      ✓ Going
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.rsvpButton,
                      item.user_rsvp === "maybe" && styles.rsvpButtonActive,
                    ]}
                    onPress={() => handleRSVP(item.id, "maybe")}
                  >
                    <Text
                      style={[
                        styles.rsvpButtonText,
                        item.user_rsvp === "maybe" && styles.rsvpButtonTextActive,
                      ]}
                    >
                      ? Maybe
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create Smoke Session</Text>
              <TextInput
                style={styles.input}
                placeholder="Event Title"
                placeholderTextColor="#888"
                value={newEventTitle}
                onChangeText={setNewEventTitle}
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description (optional)"
                placeholderTextColor="#888"
                value={newEventDescription}
                onChangeText={setNewEventDescription}
                multiline
                numberOfLines={3}
              />
              <TextInput
                style={styles.input}
                placeholder="Location (optional)"
                placeholderTextColor="#888"
                value={newEventLocation}
                onChangeText={setNewEventLocation}
              />
              <Text style={styles.inputLabel}>Date & Time:</Text>
              <Text style={styles.helperText}>Use 24-hour format. Example: 14:30 = 2:30 PM</Text>
              <TextInput
                style={styles.input}
                placeholder="Date: 2026-02-15"
                placeholderTextColor="#888"
                value={newEventDate}
                onChangeText={setNewEventDate}
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
              />
              <TextInput
                style={styles.input}
                placeholder="Time: 14:30 (hours 00-23)"
                placeholderTextColor="#888"
                value={newEventTime}
                onChangeText={setNewEventTime}
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
              <TouchableOpacity
                style={styles.quickFillButton}
                onPress={() => {
                  const now = new Date();
                  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                  const dateStr = tomorrow.toISOString().split('T')[0];
                  const hours = String(now.getHours()).padStart(2, '0');
                  const minutes = String(now.getMinutes()).padStart(2, '0');
                  const timeStr = `${hours}:${minutes}`;
                  setNewEventDate(dateStr);
                  setNewEventTime(timeStr);
                }}
              >
                <Text style={styles.quickFillText}>📅 Set to Tomorrow at Current Time</Text>
              </TouchableOpacity>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowCreateModal(false);
                    setNewEventTitle("");
                    setNewEventDescription("");
                    setNewEventLocation("");
                    setNewEventDate("");
                    setNewEventTime("");
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={handleCreateEvent}
                  disabled={creating}
                >
                  <Text style={styles.submitButtonText}>
                    {creating ? "Creating..." : "Create"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
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
  eventCard: {
    backgroundColor: "#1e1e1e",
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
  },
  eventTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  eventDescription: {
    color: "#aaa",
    fontSize: 14,
    marginBottom: 12,
  },
  eventDetails: {
    gap: 6,
    marginBottom: 16,
  },
  eventDetailText: {
    color: "#00FF7F",
    fontSize: 14,
    fontWeight: "500",
  },
  rsvpButtons: {
    flexDirection: "row",
    gap: 12,
  },
  rsvpButton: {
    flex: 1,
    backgroundColor: "#121212",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  rsvpButtonActive: {
    backgroundColor: "#00FF7F",
    borderColor: "#00FF7F",
  },
  rsvpButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  rsvpButtonTextActive: {
    color: "#121212",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#1e1e1e",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
  },
  inputLabel: {
    color: "#00FF7F",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
    marginTop: 8,
  },
  helperText: {
    color: "#888",
    fontSize: 12,
    marginBottom: 8,
    fontStyle: "italic",
  },
  input: {
    backgroundColor: "#121212",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  quickFillButton: {
    backgroundColor: "#2a2a2a",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#444",
  },
  quickFillText: {
    color: "#00FF7F",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
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
});
