import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { launchCamera, launchImageLibrary, type Asset } from 'react-native-image-picker';
import { InlineError, Pill, PrimaryCTA, ScreenScroll, SecondaryCTA, SectionCard, StatusBanner, TitleBlock, TopAppBar } from '../../components/ui';
import { useAuth } from '../../providers/AuthProvider';
import { authStyles } from './styles';

type KycDocKind = 'front_id' | 'back_id' | 'selfie';

const docCards: Array<{ kind: KycDocKind; label: string; helper: string }> = [
  { kind: 'front_id', label: 'Front ID', helper: 'Capture the front side of the student ID clearly.' },
  { kind: 'back_id', label: 'Back ID', helper: 'Capture the back side with all text visible.' },
  { kind: 'selfie', label: 'Selfie', helper: 'Take a live selfie with good lighting and a clear face.' },
];

export function KycScreen() {
  const navigation = useNavigation<any>();
  const { submitPendingKyc, pendingUser } = useAuth();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [documents, setDocuments] = useState<Record<KycDocKind, Asset | null>>({
    front_id: null,
    back_id: null,
    selfie: null,
  });

  const completedCount = useMemo(() => Object.values(documents).filter(Boolean).length, [documents]);

  async function pickDocument(kind: KycDocKind, source: 'camera' | 'gallery') {
    try {
      setError('');
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
      await submitPendingKyc({
        documents: requiredKinds.map(kind => ({
          kind,
          fileName: documents[kind]?.fileName ?? `${kind}.jpg`,
          contentType: documents[kind]?.type ?? 'image/jpeg',
          base64: documents[kind]?.base64 ?? '',
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'KYC submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenScroll>
      <TopAppBar title="KYC Verification" subtitle="Step 3 of 3" onBack={() => navigation.goBack()} />
      <TitleBlock title="Complete identity review" subtitle="Verification is required before group creation and payout withdrawal." />
      <View style={authStyles.helperBlock}>
        <Text style={authStyles.strongText}>Progress</Text>
        <View style={authStyles.progressTrack}>
          <View style={[authStyles.progressFill, { width: `${(completedCount / docCards.length) * 100}%` }]} />
        </View>
      </View>
      {docCards.map(card => {
        const asset = documents[card.kind];
        return (
          <SectionCard key={card.kind} style={authStyles.kycCard}>
            <View style={authStyles.kycDocHeader}>
              <View style={authStyles.helperBlock}>
                <Text style={authStyles.strongText}>{card.label}</Text>
                <Text style={authStyles.mutedText}>{card.helper}</Text>
              </View>
              <Pill label={asset ? 'Ready' : 'Missing'} tone={asset ? 'good' : 'warn'} />
            </View>
            <Text style={authStyles.mutedText}>{asset ? `${asset.fileName ?? card.label} is ready for upload.` : 'No file selected yet.'}</Text>
            <View style={authStyles.kycActions}>
              <SecondaryCTA label="Use Camera" onPress={() => pickDocument(card.kind, 'camera')} disabled={submitting} />
              <SecondaryCTA label="Choose Photo" onPress={() => pickDocument(card.kind, 'gallery')} disabled={submitting} />
            </View>
          </SectionCard>
        );
      })}
      <StatusBanner
        tone="warning"
        title="Review stays in the admin queue until approval."
        body={pendingUser?.fullName ? `${pendingUser.fullName} will be signed into the member workspace after submission.` : 'Your account will move to pending review after submission.'}
      />
      <InlineError message={error} />
      <PrimaryCTA label="Submit For Review" onPress={handleSubmit} loading={submitting} disabled={submitting} />
    </ScreenScroll>
  );
}
