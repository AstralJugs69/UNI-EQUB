import React, { useMemo, useState } from 'react';
import { Image, Modal, PermissionsAndroid, Platform, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { launchCamera, launchImageLibrary, type Asset } from 'react-native-image-picker';
import { Icon } from '../../components/Icon';
import { KycErrorBanner } from '../../components/AppErrors';
import { LoadingState, Pill, PrimaryCTA, ScreenScroll, SecondaryCTA, SectionCard, StatusBanner, TitleBlock, TopAppBar } from '../../components/ui';
import { queryKeys, useDashboardQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { iconSize, palette } from '../../theme/tokens';
import { authStyles } from './styles';

type KycDocKind = 'front_id' | 'back_id' | 'selfie';

const docCards: Array<{ kind: KycDocKind; label: string; helper: string }> = [
  { kind: 'front_id', label: 'Front ID', helper: 'Capture the front side of the student ID clearly.' },
  { kind: 'back_id', label: 'Back ID', helper: 'Capture the back side with all text visible.' },
  { kind: 'selfie', label: 'Selfie', helper: 'Take a live selfie with good lighting and a clear face.' },
];

async function ensureCameraPermission() {
  if (Platform.OS !== 'android') {
    return true;
  }
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
    title: 'Camera permission',
    message: 'UniEqub needs camera access to capture KYC documents.',
    buttonPositive: 'Allow',
    buttonNegative: 'Cancel',
  });
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export function KycScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { submitCurrentKyc, submitPendingKyc, pendingUser, session } = useAuth();
  const { data: dashboard } = useDashboardQuery();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [documents, setDocuments] = useState<Record<KycDocKind, Asset | null>>({
    front_id: null,
    back_id: null,
    selfie: null,
  });
  const [preview, setPreview] = useState<Asset | null>(null);

  const completedCount = useMemo(() => Object.values(documents).filter(Boolean).length, [documents]);
  const resubmissionRequested = !!session && dashboard?.kycState?.status === 'NeedsResubmission' && dashboard.kycState.canSubmit;
  const pendingSignup = !!pendingUser;
  const canSubmitKyc = pendingSignup || resubmissionRequested;

  if (session && !dashboard) {
    return <LoadingState title="Loading KYC state" subtitle="Checking whether this account needs a fresh KYC submission." />;
  }

  if (!canSubmitKyc) {
    return (
      <ScreenScroll>
        <TopAppBar title="KYC Verification" onBack={() => navigation.goBack()} />
        <TitleBlock title="No KYC submission is pending" subtitle="Start from account creation or wait for an admin resubmission request before opening this page directly." />
        {dashboard?.kycState?.status ? (
          <StatusBanner tone={dashboard.kycState.status === 'Verified' ? 'success' : dashboard.kycState.status === 'Banned' ? 'danger' : 'info'} title={`KYC status: ${dashboard.kycState.status}`} body={dashboard.kycState.decisionNote ?? undefined} />
        ) : null}
        <PrimaryCTA label={session ? 'Back To Home' : 'Back To Login'} onPress={() => session ? navigation.navigate(routes.memberTabs, { screen: routes.dashboard }) : navigation.navigate(routes.login)} />
      </ScreenScroll>
    );
  }

  async function pickDocument(kind: KycDocKind, source: 'camera' | 'gallery') {
    try {
      setError('');
      if (source === 'camera' && !(await ensureCameraPermission())) {
        throw new Error('Camera permission is required to take KYC photos.');
      }
      const result = source === 'camera'
        ? await launchCamera({ mediaType: 'photo', includeBase64: true, quality: 0.8, saveToPhotos: false })
        : await launchImageLibrary({ mediaType: 'photo', includeBase64: true, quality: 0.8, selectionLimit: 1 });

      if (result.didCancel) {
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.base64 || !asset.type) {
        throw new Error('The selected image could not be prepared for secure upload. Try again.');
      }

      setDocuments(current => ({ ...current, [kind]: asset }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to capture this document.');
    }
  }

  async function handleSubmit() {
    try {
      const requiredKinds: KycDocKind[] = ['front_id', 'back_id', 'selfie'];
      const missing = requiredKinds.find(kind => !documents[kind]?.base64);
      if (missing) {
        throw new Error('Capture all three KYC images before submission.');
      }

      setError('');
      setSubmitting(true);
      const input = {
        documents: requiredKinds.map(kind => ({
          kind,
          fileName: documents[kind]?.fileName ?? `${kind}.jpg`,
          contentType: documents[kind]?.type ?? 'image/jpeg',
          base64: documents[kind]?.base64 ?? '',
        })),
      };
      if (pendingSignup) {
        await submitPendingKyc(input);
      } else {
        await submitCurrentKyc(input);
        await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
        navigation.navigate(routes.memberTabs, { screen: routes.dashboard, params: { flash: 'KYC resubmitted for review.' } });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'KYC submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenScroll contentStyle={authStyles.kycScreen}>
      <TopAppBar title="KYC Verification" subtitle={pendingSignup ? 'Step 3 of 3' : 'Resubmission'} onBack={() => navigation.goBack()} />
      <SectionCard variant="raised" style={authStyles.kycHeroCard}>
        <View style={authStyles.kycHeroHeader}>
          <View style={authStyles.kycHeroIcon}>
            <Icon name="verified-user" size={iconSize.md} color={palette.primary} />
          </View>
          <View style={authStyles.kycHeroText}>
            <Text style={authStyles.kycHeroTitle}>{pendingSignup ? 'Verify your student identity' : 'Upload clearer KYC images'}</Text>
            <Text style={authStyles.kycHeroSubtitle}>{completedCount} of {docCards.length} images ready</Text>
          </View>
          <Pill label={`${Math.round((completedCount / docCards.length) * 100)}%`} tone={completedCount === docCards.length ? 'good' : 'active'} />
        </View>
        <View style={authStyles.progressTrack}>
          <View style={[authStyles.progressFill, { width: `${(completedCount / docCards.length) * 100}%` }]} />
        </View>
      </SectionCard>
      {docCards.map(card => {
        const asset = documents[card.kind];
        return (
          <SectionCard key={card.kind} style={authStyles.kycCard}>
            <View style={authStyles.kycDocHeader}>
              <View style={authStyles.kycDocTitleWrap}>
                <Text style={authStyles.strongText}>{card.label}</Text>
                <Text style={authStyles.mutedText}>{card.helper}</Text>
              </View>
              <Pill label={asset ? 'Ready' : 'Missing'} tone={asset ? 'good' : 'warn'} />
            </View>
            {asset?.uri ? (
              <Pressable accessibilityRole="imagebutton" accessibilityLabel={`Preview ${card.label}`} onPress={() => setPreview(asset)} style={authStyles.kycPreviewFrame}>
                <Image source={{ uri: asset.uri }} style={authStyles.kycPreviewImage} resizeMode="cover" />
                <View style={authStyles.kycPreviewBadge}>
                  <Icon name="zoom-in" size={iconSize.sm} color={palette.white} />
                  <Text style={authStyles.kycPreviewBadgeText}>Preview</Text>
                </View>
              </Pressable>
            ) : (
              <View style={authStyles.kycEmptyFrame}>
                <Icon name="add-photo-alternate" size={iconSize.lg} color={palette.primary} />
                <Text style={authStyles.kycEmptyText}>Add a clear image</Text>
              </View>
            )}
            <View style={authStyles.kycActions}>
              <SecondaryCTA label="Use Camera" onPress={() => pickDocument(card.kind, 'camera')} disabled={submitting} />
              <SecondaryCTA label="Choose Photo" onPress={() => pickDocument(card.kind, 'gallery')} disabled={submitting} />
            </View>
          </SectionCard>
        );
      })}
      <StatusBanner
        tone={resubmissionRequested ? 'info' : 'warning'}
        title={resubmissionRequested ? 'Admin requested clearer documents.' : 'Review stays in the admin queue until approval.'}
        body={resubmissionRequested ? dashboard?.kycState.decisionNote ?? 'Upload the replacement images and submit them for another review.' : pendingUser?.fullName ? `${pendingUser.fullName} will be signed into the member workspace after submission.` : 'Your account will move to pending review after submission.'}
      />
      <KycErrorBanner error={error} />
      <PrimaryCTA label="Submit For Review" onPress={handleSubmit} loading={submitting} disabled={submitting} />
      <Modal visible={!!preview?.uri} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <View style={authStyles.kycModalBackdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close preview" onPress={() => setPreview(null)} style={authStyles.kycModalClose}>
            <Icon name="close" size={iconSize.md} color={palette.white} />
          </Pressable>
          {preview?.uri ? <Image source={{ uri: preview.uri }} style={authStyles.kycModalImage} resizeMode="contain" /> : null}
        </View>
      </Modal>
    </ScreenScroll>
  );
}
