// Ac 2025 Benjamin Hawk. All rights reserved.

import { Linking, StyleSheet, Text, View, TouchableOpacity } from "react-native";

const SUPPORT_EMAIL = "hawkcade21@gmail.com";

export default function UnderageBlocked() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Access Restricted</Text>
      <Text style={styles.body}>
        BlazeMates contains matchmaking functionality and is limited to adults
        who are 21 years of age or older. In line with Google Play&apos;s
        Age-Restricted Content policy, accounts identified as underage cannot
        use the app.
      </Text>
      <Text style={styles.body}>
        If this was a mistake, please have a verified adult guardian contact our
        support team so we can review the account.
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
      >
        <Text style={styles.buttonText}>Contact Support</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() =>
          Linking.openURL(
            "https://support.google.com/googleplay/android-developer/answer/13404355"
          )
        }
      >
        <Text style={styles.secondaryText}>Read Google Play Guidance</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 24,
    justifyContent: "center",
  },
  title: {
    color: "#ff5555",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
  },
  body: {
    color: "#ddd",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 18,
  },
  button: {
    backgroundColor: "#00FF7F",
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  buttonText: {
    color: "#121212",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  secondaryButton: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#444",
  },
  secondaryText: {
    color: "#00FF7F",
    fontSize: 15,
    textAlign: "center",
  },
});
