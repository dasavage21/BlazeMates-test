import { useEffect } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../supabaseClient";

const MIN_AGE = 21;

export function useAgeGate() {
  const router = useRouter();

  useEffect(() => {
    const checkAge = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/welcome");
          return;
        }

        const { data: profile } = await supabase
          .from("users")
          .select("age")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.age !== null && profile?.age !== undefined) {
          if (profile.age < MIN_AGE) {
            await AsyncStorage.setItem("userAge", profile.age.toString());
            await supabase.auth.signOut({ scope: "local" });
            router.replace("/underage-blocked");
            return;
          }
          await AsyncStorage.setItem("userAge", profile.age.toString());
        } else {
          const storedAge = await AsyncStorage.getItem("userAge");
          if (storedAge) {
            const age = parseInt(storedAge, 10);
            if (!isNaN(age) && age < MIN_AGE) {
              await supabase.auth.signOut({ scope: "local" });
              router.replace("/underage-blocked");
            }
          }
        }
      } catch (error) {
        console.error("Age gate check failed:", error);
      }
    };

    checkAge();
  }, [router]);
}
