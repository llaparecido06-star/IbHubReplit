import colors from "@/constants/colors";

// The app always uses the light theme (per design specification)
export function useColors() {
  return { ...colors.light, radius: colors.radius, isDark: false };
}
