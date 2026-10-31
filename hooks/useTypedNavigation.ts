import { useNavigation } from "expo-router";
import type {
  EventArg,
  NavigationAction,
  NavigationProp,
  ParamListBase,
} from "expo-router/react-navigation";

export type BeforeRemoveEvent = EventArg<
  "beforeRemove",
  true,
  { action: NavigationAction }
>;

export type BeforeRemoveEventMap = {
  beforeRemove: {
    data: { action: NavigationAction };
    canPreventDefault: true;
  };
};

export type AppNavigation = NavigationProp<
  ParamListBase,
  string,
  string | undefined,
  any,
  {},
  BeforeRemoveEventMap
>;

export const useTypedNavigation = (): AppNavigation => useNavigation<AppNavigation>();
