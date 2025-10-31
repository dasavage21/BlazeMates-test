// app/index.tsx

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../supabaseClient";

const AUTH_CACHE_KEYS = [
  "userProfile",
  "userAge",
  "pendingAvatarUri",
  "avatarVersion",
  "userId",
  "theme",
];
const MIN_AGE = 21;

async function clearCachedSessionData(signOut = false) {
  if (signOut) {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (err) {
      console.warn("Failed clearing Supabase local session", err);
    }
  }

  try {
    await AsyncStorage.multiRemove(AUTH_CACHE_KEYS);
  } catch (err) {
    console.warn("Failed clearing cached auth data", err);
  }
}

const parseStoredAge = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

export default function IndexGate() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const underageBlockRef = useRef(false);

  useEffect(() => {
    const enforceAgeGate = async (userId: string | null): Promise<boolean> => {
      try {
        const storedAge = parseStoredAge(await AsyncStorage.getItem("userAge"));
        underageBlockRef.current = false;

        if (userId) {
          const { data: profile, error: profileError } = await supabase
            .from("users")
            .select("age")
            .eq("id", userId)
            .maybeSingle();

          if (!profileError && profile) {
            const remoteAge =
              typeof profile.age === "number" ? profile.age : null;

            if (remoteAge !== null) {
              if (remoteAge < MIN_AGE) {
                underageBlockRef.current = true;
                await clearCachedSessionData(true);
                router.replace("/underage-blocked");
                return true;
              }

              if (storedAge !== remoteAge) {
                await AsyncStorage.setItem("userAge", remoteAge.toString());
              }
              return false;
            }

            if (storedAge !== null && storedAge >= MIN_AGE) {
              // No remote age yet, but local cache is valid.
              return false;
            }
          }
        }

        if (storedAge !== null) {
          if (storedAge < MIN_AGE) {
            underageBlockRef.current = true;
            await clearCachedSessionData(true);
            router.replace("/underage-blocked");
            return true;
          }
          return false;
        }

        underageBlockRef.current = false;
        router.replace("/age-check");
        return true;
      } catch (err) {
        console.warn("Age gate check failed", err);
        await clearCachedSessionData(true);
        underageBlockRef.current = false;
        router.replace("/age-check");
        return true;
      }
    };

    const run = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }

        const userId = data.session?.user?.id ?? null;
        const redirected = await enforceAgeGate(userId);
        if (redirected) {
          return;
        }

        if (userId) {
          await AsyncStorage.setItem("userId", userId);
          router.replace("/swipe");
          return;
        }

        await clearCachedSessionData();
        router.replace("/login");
      } catch (err) {
        console.warn("Initial session check failed", err);
        await clearCachedSessionData(true);
        router.replace("/login");
      } finally {
        setChecking(false);
      }
    };

    // react to future auth changes as well
    const { data: sub } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const eventType = event as string;

        if (session?.user) {
          const redirected = await enforceAgeGate(session.user.id);
          if (redirected) {
            return;
          }

          await AsyncStorage.setItem("userId", session.user.id);
          router.replace("/swipe");
          return;
        }

        if (eventType === "TOKEN_REFRESH_FAILED") {
          await clearCachedSessionData(true);
        } else if (
          eventType === "SIGNED_OUT" ||
          eventType === "USER_DELETED"
        ) {
          await clearCachedSessionData();
        }

        if (underageBlockRef.current) {
          return;
        }

        router.replace("/login");
      }
    );

    run();
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (checking) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#121212",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator color="#00FF7F" />
      </View>
    );
  }
  return null;
}
