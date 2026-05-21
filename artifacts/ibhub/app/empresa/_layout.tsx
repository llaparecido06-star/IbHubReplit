import { Stack } from "expo-router";

export default function EmpresaLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="admin" />
    </Stack>
  );
}
