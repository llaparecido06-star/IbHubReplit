import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useColors } from "@/hooks/useColors";

export interface UserSummary {
  id: string;
  full_name: string;
  username?: string;
  headline?: string;
  avatar_url?: string | null;
  plan?: string;
  mutual_connections?: number;
  areas_of_expertise?: string[];
  is_connected?: boolean;
  is_following?: boolean;
}

interface UserCardProps {
  user: UserSummary;
  onConnect?: (userId: string) => void;
  onFollow?: (userId: string) => void;
  compact?: boolean;
}

export function UserCard({ user, onConnect, onFollow, compact = false }: UserCardProps) {
  const colors = useColors();
  const router = useRouter();
  const [connected, setConnected] = useState(user.is_connected ?? false);
  const [following, setFollowing] = useState(user.is_following ?? false);
  const [pendingConnect, setPendingConnect] = useState(false);

  const handleConnect = () => {
    setPendingConnect(true);
    setConnected(true);
    onConnect?.(user.id);
    if (!following) {
      setFollowing(true);
      onFollow?.(user.id);
    }
  };

  const handleFollow = () => {
    setFollowing((v) => !v);
    onFollow?.(user.id);
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactContainer, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push(`/profile/${user.id}` as any)}
      >
        <Avatar uri={user.avatar_url} name={user.full_name} size={48} />
        <View style={styles.compactInfo}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {user.full_name}
          </Text>
          {user.headline && (
            <Text style={[styles.headline, { color: colors.mutedForeground }]} numberOfLines={1}>
              {user.headline}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.followBtn, { borderColor: following ? colors.gold : colors.border }]}
          onPress={handleFollow}
        >
          <Text style={{ fontSize: 12, fontWeight: "600", color: following ? colors.gold : colors.foreground }}>
            {following ? "Seguindo" : "Seguir"}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
      onPress={() => router.push(`/profile/${user.id}` as any)}
      activeOpacity={0.85}
    >
      <Avatar uri={user.avatar_url} name={user.full_name} size={56} />
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {user.full_name}
        </Text>
        {user.headline && (
          <Text style={[styles.headline, { color: colors.mutedForeground }]} numberOfLines={2}>
            {user.headline}
          </Text>
        )}
        {user.mutual_connections != null && user.mutual_connections > 0 && (
          <Text style={[styles.mutual, { color: colors.mutedForeground }]}>
            {user.mutual_connections} conexão(ões) em comum
          </Text>
        )}
        {user.areas_of_expertise && user.areas_of_expertise.length > 0 && (
          <View style={styles.tags}>
            {user.areas_of_expertise.slice(0, 2).map((area) => (
              <Badge key={area} label={area} variant="gold" size="sm" />
            ))}
          </View>
        )}
      </View>
      <View style={styles.actions}>
        {!connected ? (
          <Button
            title={pendingConnect ? "Enviado" : "Conectar"}
            onPress={handleConnect}
            variant={pendingConnect ? "outline" : "gold"}
            size="sm"
            disabled={pendingConnect}
          />
        ) : (
          <Button
            title={following ? "Seguindo" : "Seguir"}
            onPress={handleFollow}
            variant={following ? "outline" : "secondary"}
            size="sm"
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    gap: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 15, fontWeight: "700" },
  headline: { fontSize: 12, lineHeight: 17 },
  mutual: { fontSize: 11, marginTop: 2 },
  tags: { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
  actions: { alignItems: "flex-end", justifyContent: "center" },
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
    borderBottomWidth: 1,
  },
  compactInfo: { flex: 1 },
  followBtn: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
});
