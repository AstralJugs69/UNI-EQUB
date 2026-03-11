import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  Easing,
  createAnimatedComponent,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { palette } from '../theme/tokens';

const AnimatedPath = createAnimatedComponent(Path);
const U_PATH = 'M24 14 V56 C24 79 36 98 56 98 C76 98 88 79 88 56 V14';
const U_DASH = 220;

function useStrokeLoop(duration: number) {
  const dashOffset = useSharedValue(U_DASH);

  useEffect(() => {
    dashOffset.value = withRepeat(
      withSequence(
        withTiming(0, { duration, easing: Easing.inOut(Easing.cubic) }),
        withTiming(-U_DASH, { duration, easing: Easing.inOut(Easing.cubic) }),
      ),
      -1,
      false,
    );
  }, [dashOffset, duration]);

  return useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));
}

function UGlyph({
  size,
  strokeWidth,
  duration,
}: {
  size: number;
  strokeWidth: number;
  duration: number;
}) {
  const animatedProps = useStrokeLoop(duration);

  return (
    <Svg width={size} height={size} viewBox="0 0 112 112" fill="none">
      <AnimatedPath
        d={U_PATH}
        stroke={palette.primaryDark}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={U_DASH}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}

export function AnimatedULoader({ size = 92 }: { size?: number }) {
  return (
    <View style={styles.largeWrap}>
      <UGlyph size={size} strokeWidth={10} duration={1050} />
    </View>
  );
}

export function MiniULoader({ size = 18 }: { size?: number }) {
  return (
    <View style={styles.miniWrap}>
      <UGlyph size={size} strokeWidth={3.6} duration={760} />
    </View>
  );
}

const styles = StyleSheet.create({
  largeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
