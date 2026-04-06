// Redirect to the messages tab's new conversation flow
import { useRouter } from "expo-router";
import { useEffect } from "react";
export default function NewMessageScreen() {
  const router = useRouter();
  useEffect(() => { router.replace("/(tabs)/messages" as any); }, []);
  return null;
}
