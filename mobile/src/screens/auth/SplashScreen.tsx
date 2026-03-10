import React from 'react';
import { Image, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { HeroCard, PrimaryCTA, ScreenScroll, SecondaryCTA, SectionCard, TitleBlock } from '../../components/ui';
import { routes } from '../../navigation/routes';
import { authStyles } from './styles';

const heroStudents = require('../../assets/students-hero.jpg');

export function SplashScreen() {
  const navigation = useNavigation<any>();

  return (
    <ScreenScroll contentStyle={authStyles.centeredContent}>
      <View style={authStyles.stack}>
        <View style={[authStyles.centered, authStyles.stack]}>
          <View style={authStyles.brandMark}>
            <Text style={authStyles.brandLetter}>U</Text>
          </View>
          <TitleBlock
            title="Digitize Your Equb"
            subtitle="Modern rotating savings for university circles, with verified membership, transparent rounds, and automatic draws."
            align="center"
          />
        </View>
        <HeroCard>
          <View style={authStyles.heroImageWrap}>
            <Image source={heroStudents} style={authStyles.heroImage} resizeMode="cover" />
          </View>
        </HeroCard>
        <SectionCard variant="soft">
          <Text style={authStyles.strongText}>Built for student trust networks</Text>
          <Text style={authStyles.mutedText}>
            Join approved cycles, track every contribution, and move through each round with a clear Android-native experience.
          </Text>
        </SectionCard>
        <View style={authStyles.heroActions}>
          <PrimaryCTA label="Get Started" onPress={() => navigation.navigate(routes.login)} />
          <SecondaryCTA label="Admin Sign In" onPress={() => navigation.navigate(routes.login, { roleHint: 'Admin' })} />
        </View>
      </View>
    </ScreenScroll>
  );
}
