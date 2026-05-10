// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  // Navigation & UI
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "chevron.up": "expand-less",
  "chevron.down": "expand-more",
  "arrow.right": "arrow-forward",
  "arrow.clockwise": "refresh",

  // Auth & Account
  "person.fill": "person",
  "person.2.fill": "group",
  "rectangle.portrait.and.arrow.right": "logout",

  // Alerts & Status
  "bell.fill": "notifications",
  "checkmark.circle.fill": "check-circle",
  "exclamationmark.circle.fill": "error",
  "exclamationmark.triangle.fill": "warning",
  "exclamationmark.2": "priority-high",
  "shield.fill": "security",
  "minus": "remove",

  // Documents & Media
  "doc.fill": "description",
  "doc.text.fill": "article",
  "note.text": "note",
  "photo.fill": "image",
  "camera.fill": "camera",

  // Location & Map
  "map.fill": "map",
  "location.fill": "location-on",

  // Misc
  "gear": "settings",
  "plus.circle.fill": "add-circle",
  "clock.fill": "schedule",
  "list.bullet.rectangle": "view-list",
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
