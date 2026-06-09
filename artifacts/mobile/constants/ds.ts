/**
 * Nexora Design System 2.0
 * Foundation tokens — spacing, radius, typography, shadows, palette accents.
 * Import from here rather than hard-coding values in component styles.
 */

export const DS = {
  spacing: {
    xs:      4,
    sm:      8,
    md:      12,
    lg:      16,
    xl:      20,
    xxl:     24,
    xxxl:    32,
    section: 28,
  },

  radius: {
    sm:   8,
    md:   12,
    lg:   16,
    xl:   20,
    xxl:  24,
    pill: 100,
    full: 9999,
  },

  font: {
    size: {
      xxs:     10,
      xs:      11,
      sm:      12,
      base:    14,
      md:      15,
      lg:      17,
      xl:      20,
      xxl:     26,
      display: 34,
    },
    family: {
      regular:  "Inter_400Regular",
      medium:   "Inter_500Medium",
      semibold: "Inter_600SemiBold",
      bold:     "Inter_700Bold",
    },
  },

  opacity: {
    tint10: "1A",
    tint15: "26",
    tint20: "33",
    tint25: "40",
    tint30: "4D",
    tint40: "66",
    tint55: "8C",
  },

  shadow: {
    sm: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.12,
      shadowRadius: 3,
      elevation: 2,
    },
    md: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 10,
      elevation: 5,
    },
    lg: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.24,
      shadowRadius: 20,
      elevation: 10,
    },
  },

  palette: {
    purple: "#7C6EFA",
    blue:   "#3B82F6",
    green:  "#34D399",
    gold:   "#F59E0B",
    red:    "#EF4444",
    orange: "#F97316",
    teal:   "#22D3EE",
    pink:   "#EC4899",
  },
} as const;

export type DSSpacing  = typeof DS.spacing;
export type DSRadius   = typeof DS.radius;
export type DSFont     = typeof DS.font;
export type DSShadow   = typeof DS.shadow;
export type DSPalette  = typeof DS.palette;
