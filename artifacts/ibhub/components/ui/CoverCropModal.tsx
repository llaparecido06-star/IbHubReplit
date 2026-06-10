import React, { useRef, useState, useEffect } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GOLD = "#c9a84c";
const CROP_RATIO = 3;

interface Props {
  visible: boolean;
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  onConfirm: (croppedUri: string) => void;
  onCancel: () => void;
}

export default function CoverCropModal({
  visible,
  imageUri,
  imageWidth,
  imageHeight,
  onConfirm,
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = Dimensions.get("window");

  const cropWidth = screenWidth;
  const cropHeight = Math.round(cropWidth / CROP_RATIO);

  const scaleToFill = Math.max(cropWidth / imageWidth, cropHeight / imageHeight);
  const displayW = Math.round(imageWidth * scaleToFill);
  const displayH = Math.round(imageHeight * scaleToFill);

  const initX = Math.round((cropWidth - displayW) / 2);
  const initY = Math.round((cropHeight - displayH) / 2);

  const minX = cropWidth - displayW;
  const maxX = 0;
  const minY = cropHeight - displayH;
  const maxY = 0;

  const pan = useRef(new Animated.ValueXY({ x: initX, y: initY })).current;
  const positionRef = useRef({ x: initX, y: initY });
  const [processing, setProcessing] = useState(false);

  // keep positionRef in sync for confirm handler
  useEffect(() => {
    const id = pan.addListener((val) => {
      positionRef.current = val;
    });
    return () => pan.removeListener(id);
  }, [pan]);

  // Reset when a new image is shown
  useEffect(() => {
    if (visible) {
      pan.setOffset({ x: 0, y: 0 });
      pan.setValue({ x: initX, y: initY });
      positionRef.current = { x: initX, y: initY };
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as unknown as { _value: number })._value,
          y: (pan.y as unknown as { _value: number })._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        const rawX = (pan.x as unknown as { _value: number })._value;
        const rawY = (pan.y as unknown as { _value: number })._value;
        const clampedX = Math.max(minX, Math.min(maxX, rawX));
        const clampedY = Math.max(minY, Math.min(maxY, rawY));
        Animated.spring(pan, {
          toValue: { x: clampedX, y: clampedY },
          useNativeDriver: false,
          bounciness: 0,
        }).start();
      },
    })
  ).current;

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      const { x: curX, y: curY } = positionRef.current;
      const originX = Math.max(0, Math.round(-curX / scaleToFill));
      const originY = Math.max(0, Math.round(-curY / scaleToFill));
      const cropW = Math.min(
        Math.round(cropWidth / scaleToFill),
        imageWidth - originX
      );
      const cropH = Math.min(
        Math.round(cropHeight / scaleToFill),
        imageHeight - originY
      );

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX,
              originY,
              width: Math.max(1, cropW),
              height: Math.max(1, cropH),
            },
          },
        ],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      onConfirm(result.uri);
    } catch {
      onConfirm(imageUri);
    } finally {
      setProcessing(false);
    }
  };

  const topPad = Platform.OS === "ios" ? insets.top + 8 : 28;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <View style={styles.root}>
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: topPad }]}>
          <TouchableOpacity
            onPress={onCancel}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Foto de Capa</Text>
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={processing}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            {processing ? (
              <ActivityIndicator size="small" color={GOLD} />
            ) : (
              <Text style={styles.confirmText}>Confirmar</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Hint ── */}
        <Text style={styles.hint}>Arraste para posicionar</Text>

        {/* ── Crop frame ── */}
        <View
          style={[styles.cropFrame, { width: cropWidth, height: cropHeight }]}
          {...panResponder.panHandlers}
        >
          <Animated.Image
            source={{ uri: imageUri }}
            style={{
              width: displayW,
              height: displayH,
              position: "absolute",
              transform: [{ translateX: pan.x }, { translateY: pan.y }],
            }}
            resizeMode="cover"
          />
          {/* Grid overlay */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={styles.gridV1} />
            <View style={styles.gridV2} />
            <View style={styles.gridH1} />
            <View style={[styles.border, { width: cropWidth, height: cropHeight }]} />
          </View>
        </View>

        {/* ── Info ── */}
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>📐  Proporção 3:1 — ideal para foto de capa</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  title: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  cancelText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 16,
  },
  confirmText: {
    color: GOLD,
    fontSize: 16,
    fontWeight: "700",
  },
  hint: {
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    fontSize: 13,
    marginTop: 22,
    marginBottom: 22,
  },
  cropFrame: {
    overflow: "hidden",
    alignSelf: "center",
  },
  gridV1: {
    position: "absolute",
    left: "33.33%",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  gridV2: {
    position: "absolute",
    left: "66.66%",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  gridH1: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  border: {
    borderWidth: 2,
    borderColor: GOLD,
    position: "absolute",
    top: 0,
    left: 0,
  },
  infoRow: {
    alignItems: "center",
    marginTop: 24,
    paddingHorizontal: 24,
  },
  infoText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
});
