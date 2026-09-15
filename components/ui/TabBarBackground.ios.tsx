import { StyleSheet, View } from 'react-native';

export default function BlurTabBarBackground() {
  return <View style={StyleSheet.absoluteFill} />;
}

export function useBottomTabOverflow() {
  return 0;
}
