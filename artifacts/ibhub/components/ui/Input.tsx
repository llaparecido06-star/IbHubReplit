import React, { forwardRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Feather } from "@/components/ui/Icon";
import { useColors } from "@/hooks/useColors";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Feather.glyphMap;
  rightIcon?: keyof typeof Feather.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    { label, error, leftIcon, rightIcon, onRightIconPress, containerStyle, style, ...props },
    ref
  ) => {
    const colors = useColors();
    const [focused, setFocused] = useState(false);

    return (
      <View style={[styles.wrapper, containerStyle]}>
        {label && (
          <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
        )}
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.card,
              borderColor: error ? colors.destructive : focused ? colors.gold : colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          {leftIcon && (
            <Feather name={leftIcon} size={18} color={colors.mutedForeground} style={styles.leftIcon} />
          )}
          <TextInput
            ref={ref}
            style={[
              styles.input,
              { color: colors.foreground },
              leftIcon && { paddingLeft: 0 },
              style,
            ]}
            placeholderTextColor={colors.mutedForeground}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            {...props}
          />
          {rightIcon && (
            <TouchableOpacity onPress={onRightIconPress} style={styles.rightIcon}>
              <Feather name={rightIcon} size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
        {error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}
      </View>
    );
  }
);

Input.displayName = "Input";

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", letterSpacing: 0.2 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    paddingHorizontal: 14,
  },
  leftIcon: { marginRight: 10 },
  rightIcon: { padding: 4 },
  input: { flex: 1, fontSize: 15, paddingVertical: 13 },
  error: { fontSize: 12, marginTop: 2 },
});
