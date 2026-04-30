import { useEventListener } from "expo";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Feather } from "@/components/ui/Icon";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const DEFAULT_MAX_HEIGHT = Math.round(SCREEN_H * 0.85);
const GOLD = "#c9a84c";

function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export interface FeedVideoProps {
  uri: string;
  isVisible?: boolean;
  width?: number;
  maxHeight?: number;
  startMuted?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  /**
   * Called when the user manually starts playback. The parent feed should
   * promote this video to the active one so other videos pause.
   */
  onUserPlay?: () => void;
}

export function FeedVideo({
  uri,
  isVisible = true,
  width = SCREEN_W,
  maxHeight = DEFAULT_MAX_HEIGHT,
  startMuted = true,
  containerStyle,
  onUserPlay,
}: FeedVideoProps) {
  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(startMuted);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [barWidth, setBarWidth] = useState(0);
  const controlsAnim = useRef(new Animated.Value(1)).current;
  const controlsShown = useRef(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoViewRef = useRef<VideoView>(null);

  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.muted = startMuted;
  });

  // Once the user explicitly pauses, don't let scroll-driven auto-play
  // restart the video until they tap play again.
  const userPausedRef = useRef(false);

  useEffect(() => {
    if (isVisible) {
      if (!userPausedRef.current) player.play();
    } else {
      player.pause();
      // Reset to the start so the next time the video scrolls back into
      // view (or another user takes over) it begins fresh.
      try { player.currentTime = 0; } catch { /* not yet ready */ }
    }
  }, [isVisible, player]);

  useEventListener(player, "playingChange", ({ isPlaying }) => setPlaying(isPlaying));
  useEventListener(player, "mutedChange", (e) => setMuted(e.muted));
  useEventListener(player, "videoTrackChange", ({ videoTrack }) => {
    const size = videoTrack?.size;
    if (size && size.width > 0 && size.height > 0) {
      setAspectRatio(size.width / size.height);
    }
  });

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentTime(player.currentTime);
      if (!duration && player.duration > 0) setDuration(player.duration);
    }, 250);
    return () => clearInterval(id);
  }, [player, duration]);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      Animated.timing(controlsAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      controlsShown.current = false;
    }, 3000);
  }, [controlsAnim]);

  const showAndSchedule = useCallback(() => {
    controlsShown.current = true;
    Animated.timing(controlsAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    scheduleHide();
  }, [controlsAnim, scheduleHide]);

  useEffect(() => {
    scheduleHide();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [scheduleHide]);

  const togglePlay = useCallback(() => {
    if (player.playing) {
      userPausedRef.current = true;
      player.pause();
    } else {
      userPausedRef.current = false;
      player.muted = false;
      player.play();
      onUserPlay?.();
    }
    showAndSchedule();
  }, [player, showAndSchedule, onUserPlay]);

  const toggleMute = useCallback(() => {
    player.muted = !player.muted;
    showAndSchedule();
  }, [player, showAndSchedule]);

  const handleSeek = useCallback((event: { nativeEvent: { locationX: number } }) => {
    if (!barWidth || !duration) return;
    const ratio = Math.max(0, Math.min(1, event.nativeEvent.locationX / barWidth));
    player.seekBy(ratio * duration - player.currentTime);
    showAndSchedule();
  }, [barWidth, duration, player, showAndSchedule]);

  const handlePress = useCallback(() => {
    if (!controlsShown.current) showAndSchedule();
    else togglePlay();
  }, [showAndSchedule, togglePlay]);

  const containerHeight = Math.min(width / aspectRatio, maxHeight);
  const fillWidth = duration > 0 ? (currentTime / duration) * barWidth : 0;

  return (
    <View style={[styles.container, { width, height: containerHeight }, containerStyle]}>
      <VideoView
        ref={videoViewRef}
        player={player}
        contentFit="contain"
        style={styles.video}
        nativeControls={false}
        allowsFullscreen
      />

      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={handlePress}
      >
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: controlsAnim }]}>
          {!playing && (
            <View style={styles.centerOverlay}>
              <View style={styles.playBtn}>
                <Feather name="play" size={26} color="#fff" />
              </View>
            </View>
          )}

          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.7)"]}
            style={styles.controlsBar}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              activeOpacity={1}
              style={styles.progressHit}
              onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
              onPress={handleSeek}
            >
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: fillWidth }]} />
              </View>
            </TouchableOpacity>

            <View style={styles.buttonsRow}>
              <TouchableOpacity onPress={togglePlay} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
                <Feather name={playing ? "pause" : "play"} size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleMute} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
                <Feather name={muted ? "volume-x" : "volume-2"} size={16} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.timeText}>{fmtTime(currentTime)} / {fmtTime(duration)}</Text>
              <TouchableOpacity
                onPress={() => { videoViewRef.current?.enterFullscreen(); showAndSchedule(); }}
                hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              >
                <Feather name="maximize" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={toggleMute}
        style={styles.muteBadge}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather name={muted ? "volume-x" : "volume-2"} size={14} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "#000",
    alignSelf: "center",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  centerOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 4,
  },
  controlsBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 24,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  progressHit: {
    paddingVertical: 8,
    marginBottom: 2,
  },
  progressTrack: {
    height: 3,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: GOLD,
    borderRadius: 3,
  },
  buttonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timeText: {
    color: "#fff",
    fontSize: 11,
    flex: 1,
    fontVariant: ["tabular-nums"],
  },
  muteBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});
