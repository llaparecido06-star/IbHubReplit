import React, { useCallback, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from "expo-audio";
import { Feather } from "@/components/ui/Icon";
import { useColors } from "@/hooks/useColors";

interface Props {
  uri: string;
  isMe: boolean;
  timeLabel?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

function fmtSeconds(sec: number): string {
  const safe = Number.isFinite(sec) && sec > 0 ? sec : 0;
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Module-level "current player" so that pressing play on one bubble pauses
// any other one in the screen (single-stream audio, like WhatsApp).
let activePauseRef: (() => void) | null = null;

function safePause(player: ReturnType<typeof useAudioPlayer>) {
  // expo-audio throws if the underlying player has already been released
  // (e.g. screen unmount race). We don't want that to crash the UI.
  try {
    player.pause();
  } catch (err) {
    if (__DEV__) console.warn("[AudioBubble] pause failed:", err);
  }
}

export function AudioBubble({ uri, isMe, timeLabel, containerStyle }: Props) {
  const colors = useColors();
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);

  const playing = !!status?.playing;
  const duration = Number.isFinite(status?.duration) ? (status?.duration ?? 0) : 0;
  const currentTime = Number.isFinite(status?.currentTime) ? (status?.currentTime ?? 0) : 0;
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  // Stable ref to "pause this bubble" so other bubbles can stop us without
  // capturing a stale player reference.
  const pauseSelfRef = useRef<() => void>(() => {});
  pauseSelfRef.current = () => safePause(player);

  // Auto-rewind when playback finishes so a subsequent press starts from 0.
  const didFinish = !!status?.didJustFinish;
  useEffect(() => {
    if (!didFinish) return;
    safePause(player);
    try {
      player.seekTo(0);
    } catch (err) {
      if (__DEV__) console.warn("[AudioBubble] seek-to-0 after finish failed:", err);
    }
    if (activePauseRef === pauseSelfRef.current) activePauseRef = null;
  }, [didFinish, player]);

  // Drop the global "active player" reference when this bubble unmounts so a
  // stale reference can't keep an old player from being garbage collected.
  useEffect(() => {
    return () => {
      if (activePauseRef === pauseSelfRef.current) activePauseRef = null;
      safePause(player);
    };
  }, [player]);

  const onToggle = useCallback(() => {
    if (playing) {
      safePause(player);
      if (activePauseRef === pauseSelfRef.current) activePauseRef = null;
      return;
    }
    // Pause whatever else is currently playing in this screen.
    if (activePauseRef && activePauseRef !== pauseSelfRef.current) {
      activePauseRef();
    }
    // Restart from the beginning if we previously hit the end.
    if (duration > 0 && currentTime >= duration - 0.05) {
      try {
        player.seekTo(0);
      } catch (err) {
        if (__DEV__) console.warn("[AudioBubble] seek before replay failed:", err);
      }
    }
    // Ensure the audio session allows playback through the speaker even
    // when the device ringer switch is off (silent mode), matching
    // WhatsApp / Telegram behaviour.
    setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    try {
      player.play();
      activePauseRef = pauseSelfRef.current;
    } catch (err) {
      if (__DEV__) console.warn("[AudioBubble] play failed:", err);
    }
  }, [playing, player, duration, currentTime]);

  // While playing, show remaining time (WhatsApp-style); otherwise total.
  const tickerSeconds = playing ? Math.max(duration - currentTime, 0) : duration;

  return (
    <View style={[styles.row, containerStyle]}>
      <TouchableOpacity
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={playing ? "Pausar áudio" : "Reproduzir áudio"}
        style={[
          styles.btn,
          { backgroundColor: isMe ? "rgba(255,255,255,0.2)" : colors.navy + "15" },
        ]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather
          name={playing ? "pause" : "play"}
          size={16}
          color={isMe ? "#fff" : colors.navy}
        />
      </TouchableOpacity>
      <View style={styles.middle}>
        <View
          style={[
            styles.bar,
            { backgroundColor: isMe ? "rgba(255,255,255,0.3)" : colors.border },
          ]}
        >
          <View
            style={[
              styles.fill,
              {
                backgroundColor: isMe ? "#fff" : colors.navy,
                width: `${Math.round(progress * 100)}%`,
              },
            ]}
          />
        </View>
        <Text
          style={[
            styles.dur,
            { color: isMe ? "rgba(255,255,255,0.6)" : colors.mutedForeground },
          ]}
        >
          {fmtSeconds(tickerSeconds)}
        </Text>
      </View>
      {timeLabel ? (
        <Text
          style={[
            styles.time,
            { color: isMe ? "rgba(255,255,255,0.6)" : colors.mutedForeground },
          ]}
        >
          {timeLabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 4,
    minWidth: 200,
  },
  btn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  middle: { flex: 1, gap: 4 },
  bar: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2 },
  dur: { fontSize: 10, fontWeight: "500" },
  time: { fontSize: 11 },
});
