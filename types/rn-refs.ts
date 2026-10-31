import type { ComponentRef } from "react";
import { ScrollView, TextInput } from "react-native";

// RN 0.88: the `TextInput` / `ScrollView` identifiers are component types,
// not instance types. Use ComponentRef to get the real ref instance type.
export type TextInputRef = ComponentRef<typeof TextInput>;
export type ScrollViewRef = ComponentRef<typeof ScrollView>;
