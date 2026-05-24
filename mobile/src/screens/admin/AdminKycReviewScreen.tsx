import React, { useState } from 'react';
import { Alert, Image, Modal, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../../components/Icon';
import { InlineError, LoadingState, Pill, ScreenScroll, SectionCard, TopAppBar } from '../../components/ui';
import { useAdminActions, usePendingKycQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import type { KycDocumentKind, KycDocumentRecord } from '../../types/domain';
import { iconSize, palette } from '../../theme/tokens';
import { adminStyles } from './styles';

const documentSlots: Array<{ kind: KycDocumentKind; title: string; fallback: string }> = [
  { kind: 'front_id', title: 'Front ID', fallback: 'Front side of the student ID' },
  { kind: 'back_id', title: 'Back ID', fallback: 'Back side of the student ID' },
  { kind: 'selfie', title: 'Selfie', fallback: 'Live selfie or face check' },
];

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Pending upload time';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} - ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function documentImageUri(document?: KycDocumentRecord | null) {
  const uri = document?.signedUrl ?? document?.signed_url ?? document?.storage_ref;
  return uri?.startsWith('http') || uri?.startsWith('file:') || uri?.startsWith('data:') ? uri : null;
}

function KycImageCard({
  title,
  fallback,
  document,
  onOpen,
}: {
  title: string;
  fallback: string;
  document?: KycDocumentRecord | null;
  onOpen: (document: KycDocumentRecord) => void;
}) {
  const imageUri = documentImageUri(document);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!document || !imageUri}
      onPress={() => document && onOpen(document)}
      style={adminStyles.kycImageCard}
    >
      <View style={adminStyles.kycImagePreview}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={adminStyles.kycImageThumbnail} resizeMode="cover" />
        ) : (
          <View style={adminStyles.kycImagePlaceholder}>
            <Icon name="image" size={iconSize.lg} color={palette.primary} />
          </View>
        )}
      </View>
      <View style={adminStyles.kycImageCardText}>
        <Text style={adminStyles.kycDocumentTitle}>{title}</Text>
        <Text style={adminStyles.kycDocumentSubtitle}>{document?.file_name ?? fallback}</Text>
        <Text style={adminStyles.kycDocumentMeta}>{document ? `Uploaded on ${formatDateTime(document.uploaded_at)}` : 'No image submitted for this slot'}</Text>
      </View>
      {imageUri ? <Text style={adminStyles.kycImageOpenText}>Tap to view</Text> : null}
    </Pressable>
  );
}

function ChecklistItem({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <View style={adminStyles.kycChecklistItem}>
      <View style={adminStyles.kycChecklistIcon}>
        <Icon name="check" size={13} color={palette.white} />
      </View>
      <View style={adminStyles.kycChecklistText}>
        <Text style={adminStyles.kycChecklistTitle}>{title}</Text>
        <Text style={adminStyles.kycChecklistBody}>{body}</Text>
      </View>
    </View>
  );
}

function DecisionButton({
  label,
  icon,
  tone,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  icon: string;
  tone: 'primary' | 'outline' | 'danger';
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        adminStyles.kycDecisionButton,
        tone === 'primary' && adminStyles.kycDecisionButtonPrimary,
        tone === 'danger' && adminStyles.kycDecisionButtonDanger,
        disabled && adminStyles.kycDecisionButtonDisabled,
      ]}
    >
      <Icon name={icon} size={iconSize.sm} color={tone === 'primary' ? palette.white : tone === 'danger' ? palette.danger : palette.primary} />
      <Text
        style={[
          adminStyles.kycDecisionButtonText,
          tone === 'primary' && adminStyles.kycDecisionButtonTextPrimary,
          tone === 'danger' && adminStyles.kycDecisionButtonTextDanger,
        ]}
      >
        {loading ? 'Working...' : label}
      </Text>
    </Pressable>
  );
}

export function AdminKycReviewScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const userId = route.params?.userId ?? '';
  const { data = [] } = usePendingKycQuery();
  const item = data.find(row => row.user.User_ID === userId);
  const { approveKyc, requestKycResubmission, banUser } = useAdminActions();
  const [error, setError] = useState('');
  const [previewDocument, setPreviewDocument] = useState<KycDocumentRecord | null>(null);
  const busy = approveKyc.isPending || requestKycResubmission.isPending || banUser.isPending;

  if (!item) {
    return <LoadingState title="Loading KYC review" subtitle="Finding the selected queue item." />;
  }
  const reviewItem = item;
  const status = reviewItem.submission?.status ?? reviewItem.user.KYC_Status;
  const documents = reviewItem.documents?.length ? reviewItem.documents : [];
  const legacyDocument: KycDocumentRecord | null = documents.length ? null : reviewItem.user.Student_ID_Img ? {
    id: `legacy-${reviewItem.user.User_ID}`,
    submission_id: reviewItem.submission?.id ?? `legacy-${reviewItem.user.User_ID}`,
    user_id: reviewItem.user.User_ID,
    kind: 'legacy_student_id',
    storage_ref: reviewItem.user.Student_ID_Img,
    bucket: null,
    object_path: null,
    file_name: 'Legacy student ID',
    content_type: null,
    metadata: {},
    uploaded_at: reviewItem.user.Created_At,
  } : null;

  function returnToQueue(flash: string) {
    navigation.navigate(routes.adminTabs, { screen: routes.adminKyc, params: { flash } });
  }

  function runDecision(action: () => void) {
    setError('');
    action();
  }

  function confirmBan() {
    Alert.alert('Ban account', `Ban ${reviewItem.user.Full_Name} and reject the current KYC submission?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Ban',
        style: 'destructive',
        onPress: () => runDecision(() => banUser.mutate(reviewItem.user.User_ID, {
          onSuccess: () => returnToQueue('Account banned.'),
          onError: err => setError(err instanceof Error ? err.message : 'Unable to ban this account.'),
        })),
      },
    ]);
  }

  return (
    <ScreenScroll>
      <TopAppBar title="KYC Review" subtitle="Admin Detail" onBack={() => navigation.goBack()} rightLabel={status} />

      <SectionCard style={adminStyles.kycReviewProfileCard}>
        <View style={adminStyles.kycReviewProfileTop}>
          <View style={adminStyles.kycReviewAvatar}>
            <Icon name="person" size={34} color={palette.primary} />
          </View>
          <View style={adminStyles.kycReviewProfileText}>
            <Text style={adminStyles.kycReviewName}>{reviewItem.user.Full_Name}</Text>
            <Text style={adminStyles.kycReviewPhone}>{reviewItem.user.Phone_Number}</Text>
            <Pill label={status} tone={status === 'Approved' || status === 'Verified' ? 'good' : 'warn'} />
          </View>
        </View>
        <View style={adminStyles.kycReviewDivider} />
        <View style={adminStyles.kycReviewNoteRow}>
          <View style={adminStyles.kycReviewNoteIcon}>
            <Icon name="rate-review" size={iconSize.md} color={palette.primary} />
          </View>
          <View style={adminStyles.kycReviewNoteText}>
            <Text style={adminStyles.kycReviewNoteTitle}>Review note</Text>
            <Text style={adminStyles.kycReviewNoteBody}>{reviewItem.note}</Text>
          </View>
        </View>
      </SectionCard>

      <SectionCard style={adminStyles.kycReviewDocumentsCard}>
        <View style={adminStyles.kycReviewSectionHeader}>
          <View>
            <Text style={adminStyles.kycReviewSectionTitle}>Documents</Text>
            <Text style={adminStyles.kycReviewSectionBody}>Review the submitted KYC references before making a decision.</Text>
          </View>
          <Text style={adminStyles.kycReviewDocumentCount}>{documents.length || (legacyDocument ? 1 : 0)} document{(documents.length || (legacyDocument ? 1 : 0)) === 1 ? '' : 's'}</Text>
        </View>
        <View style={adminStyles.kycImageGrid}>
          {documentSlots.map(slot => {
            const document = documents.find(item => item.kind === slot.kind) ?? (slot.kind === 'front_id' ? legacyDocument : null);
            return (
              <KycImageCard
                key={slot.kind}
                title={slot.title}
                fallback={slot.fallback}
                document={document}
                onOpen={setPreviewDocument}
              />
            );
          })}
        </View>
      </SectionCard>

      <Modal visible={!!previewDocument} transparent animationType="fade" onRequestClose={() => setPreviewDocument(null)}>
        <View style={adminStyles.kycImageModalBackdrop}>
          <View style={adminStyles.kycImageModalCard}>
            <View style={adminStyles.kycReviewSectionHeader}>
              <View>
                <Text style={adminStyles.kycReviewSectionTitle}>{previewDocument?.kind.replace(/_/g, ' ')}</Text>
                <Text style={adminStyles.kycReviewSectionBody}>{previewDocument?.file_name ?? previewDocument?.storage_ref}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setPreviewDocument(null)} style={adminStyles.kycDocumentDownload}>
                <Icon name="close" size={iconSize.sm} color={palette.text} />
              </Pressable>
            </View>
            {documentImageUri(previewDocument) ? (
              <Image source={{ uri: documentImageUri(previewDocument)! }} style={adminStyles.kycImageFull} resizeMode="contain" />
            ) : null}
          </View>
        </View>
      </Modal>

      <SectionCard style={adminStyles.kycChecklistCard}>
        <View style={adminStyles.kycChecklistHeader}>
          <Icon name="verified-user" size={iconSize.sm} color={palette.primary} />
          <Text style={adminStyles.kycChecklistHeading}>Review checklist</Text>
        </View>
        <View style={adminStyles.kycChecklistGrid}>
          <ChecklistItem title="Photo clarity" body="Clear and readable" />
          <ChecklistItem title="Name match" body="Matches profile" />
          <ChecklistItem title="Student validity" body="Valid student ID" />
        </View>
      </SectionCard>

      <InlineError message={error} />
      <DecisionButton
        label="Approve KYC"
        icon="check-circle"
        tone="primary"
        loading={approveKyc.isPending}
        disabled={busy}
        onPress={() => runDecision(() => approveKyc.mutate(reviewItem.user.User_ID, {
          onSuccess: () => returnToQueue('KYC approved.'),
          onError: err => setError(err instanceof Error ? err.message : 'Unable to approve KYC.'),
        }))}
      />
      <DecisionButton
        label="Request Resubmission"
        icon="history"
        tone="outline"
        loading={requestKycResubmission.isPending}
        disabled={busy}
        onPress={() => runDecision(() => requestKycResubmission.mutate(reviewItem.user.User_ID, {
          onSuccess: () => returnToQueue('KYC resubmission requested.'),
          onError: err => setError(err instanceof Error ? err.message : 'Unable to request resubmission.'),
        }))}
      />
      <DecisionButton label="Ban Account" icon="gpp-bad" tone="danger" loading={banUser.isPending} disabled={busy} onPress={confirmBan} />
    </ScreenScroll>
  );
}
