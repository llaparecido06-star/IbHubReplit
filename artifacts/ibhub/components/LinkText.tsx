import React, { useMemo } from "react";
import { Linking, type StyleProp, Text, type TextProps, type TextStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

const URL_RE =
  /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
const TRAILING_PUNCT = /[.,;:!?)\]}'"»…]+$/;

export type LinkSegment = { text: string; url?: string };

/** Splits a string into plain-text and link segments (http/https/www URLs + emails). */
export function splitLinks(input: string): LinkSegment[] {
  const segments: LinkSegment[] = [];
  if (!input) return segments;
  const re = new RegExp(URL_RE.source, "gi");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    let raw = m[0];
    const start = m.index;
    const trail = raw.match(TRAILING_PUNCT);
    if (trail) raw = raw.slice(0, raw.length - trail[0].length);
    if (!raw) {
      re.lastIndex = start + m[0].length;
      continue;
    }
    if (start > last) segments.push({ text: input.slice(last, start) });
    const isEmail = raw.includes("@") && !raw.includes("/");
    const url = isEmail
      ? `mailto:${raw}`
      : raw.startsWith("www.")
        ? `https://${raw}`
        : raw;
    segments.push({ text: raw, url });
    last = start + raw.length;
    re.lastIndex = last;
  }
  if (last < input.length) segments.push({ text: input.slice(last) });
  return segments;
}

/** Opens a detected link, swallowing errors (e.g. no app to handle the scheme). */
export function openLink(url: string): void {
  void Linking.openURL(url).catch(() => {});
}

export interface LinkTextProps extends Omit<TextProps, "children"> {
  children?: string | null;
  style?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
}

/**
 * Drop-in replacement for `<Text>{stringContent}</Text>` that turns any URLs or
 * emails inside the text into tappable links. Non-link text still bubbles taps
 * up to a parent Pressable (e.g. to open a post), while links open directly.
 */
export function LinkText({ children, style, linkStyle, ...rest }: LinkTextProps) {
  const colors = useColors();
  const text = typeof children === "string" ? children : "";
  const segments = useMemo(() => splitLinks(text), [text]);
  const defaultLinkStyle: TextStyle = { color: colors.gold, textDecorationLine: "underline" };

  if (segments.length === 0) {
    return (
      <Text style={style} {...rest}>
        {text}
      </Text>
    );
  }

  return (
    <Text style={style} {...rest}>
      {segments.map((seg, i) =>
        seg.url ? (
          <Text
            key={i}
            style={[defaultLinkStyle, linkStyle]}
            onPress={(e) => { e.stopPropagation(); openLink(seg.url!); }}
            suppressHighlighting
          >
            {seg.text}
          </Text>
        ) : (
          <Text key={i}>{seg.text}</Text>
        ),
      )}
    </Text>
  );
}
