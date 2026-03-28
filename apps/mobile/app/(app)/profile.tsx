import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../store/authStore';
import { updateProfile } from '../../lib/api/auth';
import { getGroupHistory } from '../../lib/api/groups';
import { Avatar } from '../../components/ui/Avatar';
import { supabase } from '../../lib/supabase';
import type { Group } from '../../constants/types';
import { Colors, Spacing, Radius, Typography } from '../../constants/theme';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROMPT_KEYS = ['prompt_1', 'prompt_2', 'prompt_3'] as const;
type PromptKey = typeof PROMPT_KEYS[number];

const PROMPT_QUESTIONS = [
  'My ideal Saturday looks like\u2026',
  'The best way to get to know me is\u2026',
  "I'm looking for people who\u2026",
  'A random fact about me is\u2026',
  "I'll know we'll get along if\u2026",
  'The most spontaneous thing I\u2019ve done is\u2026',
  'My love language is\u2026',
  "I'm weirdly obsessed with\u2026",
];

interface PromptData {
  question: string;
  answer: string;
}

type PromptsMap = Partial<Record<PromptKey, PromptData>>;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut, refreshProfile } = useAuth();

  // Group history
  const [pastGroups, setPastGroups] = useState<Group[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Prompts
  const [prompts, setPrompts] = useState<PromptsMap>({});
  const [promptsLoading, setPromptsLoading] = useState(false);

  // Modals
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);

  // Sign out
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  // Avatar upload
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Settings help row
  const [helpExpanded, setHelpExpanded] = useState(false);

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  const loadHistory = useCallback(async () => {
    if (!user) return;
    setHistoryLoading(true);
    try {
      const { data } = await getGroupHistory(user.id);
      setPastGroups(data ?? []);
    } finally {
      setHistoryLoading(false);
    }
  }, [user]);

  const loadPrompts = useCallback(async () => {
    if (!user) return;
    setPromptsLoading(true);
    try {
      const { data } = await supabase
        .from('questionnaire_answers')
        .select('question_key, answer')
        .eq('user_id', user.id)
        .in('question_key', ['prompt_1', 'prompt_2', 'prompt_3']);

      if (data) {
        const map: PromptsMap = {};
        for (const row of data) {
          const key = row.question_key as PromptKey;
          if (
            typeof row.answer === 'object' &&
            row.answer !== null &&
            !Array.isArray(row.answer)
          ) {
            const raw = row.answer as Record<string, unknown>;
            if (
              typeof raw.question === 'string' &&
              typeof raw.answer === 'string'
            ) {
              map[key] = { question: raw.question, answer: raw.answer };
            }
          }
        }
        setPrompts(map);
      }
    } finally {
      setPromptsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadHistory();
    loadPrompts();
  }, [loadHistory, loadPrompts]);

  // -------------------------------------------------------------------------
  // Sign out — two-tap with 3 s timeout
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!confirmingSignOut) return;
    const timer = setTimeout(() => setConfirmingSignOut(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmingSignOut]);

  const handleSignOut = async () => {
    if (!confirmingSignOut) {
      setConfirmingSignOut(true);
      return;
    }
    setSignOutLoading(true);
    setConfirmingSignOut(false);
    await signOut();
    setSignOutLoading(false);
  };

  // -------------------------------------------------------------------------
  // Avatar upload
  // -------------------------------------------------------------------------

  const handleAvatarPress = async () => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
      return;
    }

    // Native (iOS / Android)
    if (!user) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.[0]) return;

      setUploading(true);
      const uri = result.assets[0].uri;

      // Fetch the image as a blob for Supabase upload
      const response = await fetch(uri);
      const blob = await response.blob();

      const { error } = await supabase.storage
        .from('avatars')
        .upload(`${user.id}/avatar.jpg`, blob, {
          upsert: true,
          contentType: 'image/jpeg',
        });

      if (error) {
        Alert.alert('Upload failed', error.message);
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(`${user.id}/avatar.jpg`);

      await updateProfile(user.id, { avatar_url: urlData.publicUrl });
      await refreshProfile();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not upload photo.');
    } finally {
      setUploading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : '\u2013';

  const peopleMet = pastGroups.length * 4;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Hidden file input — web avatar upload */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="user"
          style={{ display: 'none' }}
          onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file || !user) return;
            setUploading(true);
            // Reset the input so the same file can be re-selected later
            e.target.value = '';
            const { error } = await supabase.storage
              .from('avatars')
              .upload(`${user.id}/avatar.jpg`, file, { upsert: true });
            if (!error) {
              const { data: urlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(`${user.id}/avatar.jpg`);
              await updateProfile(user.id, { avatar_url: urlData.publicUrl });
              await refreshProfile();
            }
            setUploading(false);
          }}
        />
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------------------------------------------------------- */}
        {/* 1. Header — avatar + name + basics                               */}
        {/* ---------------------------------------------------------------- */}
        <View style={styles.headerSection}>
          {/* Avatar with camera badge */}
          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={handleAvatarPress}
            activeOpacity={0.85}
          >
            <Avatar
              name={profile?.first_name ?? profile?.display_name ?? '?'}
              imageUrl={profile?.avatar_url}
              size="xl"
            />
            <View style={styles.cameraBadge}>
              {uploading ? (
                <ActivityIndicator size="small" color={Colors.textPrimary} />
              ) : (
                <Ionicons name="camera" size={13} color={Colors.textPrimary} />
              )}
            </View>
          </TouchableOpacity>

          {/* Name + age */}
          <View style={styles.nameRow}>
            <Text style={styles.displayName}>
              {profile?.first_name ?? profile?.display_name ?? 'Anonymous'}
            </Text>
            {profile?.age ? (
              <Text style={styles.agePill}>{profile.age}</Text>
            ) : null}
          </View>

          {/* Nickname (pre-meet identity) */}
          {profile?.nickname ? (
            <View style={styles.nicknameRow}>
              <Text style={styles.nicknameLabel}>@{profile.nickname}</Text>
              <Text style={styles.nicknameHint}>shown to group before check-in</Text>
            </View>
          ) : null}

          {/* Neighborhood */}
          {profile?.neighborhood ? (
            <View style={styles.neighborhoodRow}>
              <Text style={styles.neighborhoodIcon}>📍</Text>
              <Text style={styles.neighborhoodText}>{profile.neighborhood}</Text>
            </View>
          ) : null}

          {/* Bio */}
          {profile?.bio ? (
            <Text style={styles.bioText}>{profile.bio}</Text>
          ) : null}

          {/* Action buttons row */}
          <View style={styles.profileButtonRow}>
            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={() => setEditModalVisible(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="pencil-outline" size={14} color={Colors.accent} />
              <Text style={styles.editProfileButtonText}>Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.previewProfileButton}
              onPress={() => setPreviewModalVisible(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="eye-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.previewProfileButtonText}>Preview</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* Privacy banner                                                    */}
        {/* ---------------------------------------------------------------- */}
        <View style={styles.privacyBanner}>
          <Text style={styles.privacyIcon}>🔒</Text>
          <Text style={styles.privacyText}>
            Your profile is private until you check in at your first Squad meetup.
            Other members only see your nickname until then — your first name is revealed after check-in.
          </Text>
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* 2. Fun Prompts (Hinge-style)                                     */}
        {/* ---------------------------------------------------------------- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About me</Text>

          {promptsLoading ? (
            <ActivityIndicator
              color={Colors.accent}
              style={{ marginTop: Spacing.md }}
            />
          ) : (
            PROMPT_KEYS.map((key) => {
              const prompt = prompts[key];
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.promptCard}
                  onPress={() => setEditModalVisible(true)}
                  activeOpacity={0.8}
                >
                  {prompt ? (
                    <>
                      <Text style={styles.promptQuestion}>{prompt.question}</Text>
                      <Text style={styles.promptAnswer}>{prompt.answer}</Text>
                    </>
                  ) : (
                    <View style={styles.promptEmpty}>
                      <View style={styles.promptAddIcon}>
                        <Ionicons name="add" size={18} color={Colors.accent} />
                      </View>
                      <Text style={styles.promptEmptyText}>Add a prompt</Text>
                    </View>
                  )}
                  <View style={styles.promptEditBadge}>
                    <Ionicons
                      name="pencil-outline"
                      size={13}
                      color={Colors.textTertiary}
                    />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* 3. Stats row                                                      */}
        {/* ---------------------------------------------------------------- */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {historyLoading ? '\u2013' : pastGroups.length}
            </Text>
            <Text style={styles.statLabel}>Meetups</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {historyLoading ? '\u2013' : peopleMet}
            </Text>
            <Text style={styles.statLabel}>People met</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{memberSince}</Text>
            <Text style={styles.statLabel}>Member since</Text>
          </View>
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* 4. Group history                                                  */}
        {/* ---------------------------------------------------------------- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group History</Text>
          {historyLoading ? (
            <ActivityIndicator
              color={Colors.accent}
              style={{ marginTop: Spacing.md }}
            />
          ) : pastGroups.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons
                name="people-outline"
                size={32}
                color={Colors.textTertiary}
              />
              <Text style={styles.emptyCardText}>
                No past meetups yet. Your history will appear here after your
                first event.
              </Text>
            </View>
          ) : (
            pastGroups.map((group) => (
              <View key={group.id} style={styles.historyItem}>
                <View style={styles.historyIconWrapper}>
                  <Ionicons name="people" size={18} color={Colors.accent} />
                </View>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyGroupName}>
                    {group.name ?? 'Meetup'}
                  </Text>
                  {group.venue && (
                    <Text style={styles.historyVenue}>{group.venue.name}</Text>
                  )}
                  {group.scheduled_time && (
                    <Text style={styles.historyDate}>
                      {new Date(group.scheduled_time).toLocaleDateString(
                        'en-US',
                        { month: 'short', day: 'numeric', year: 'numeric' }
                      )}
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* 5. Settings                                                       */}
        {/* ---------------------------------------------------------------- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>

          <SettingsRow
            icon="calendar-outline"
            label="Update Availability"
            onPress={() => router.push('/(app)/availability-edit')}
          />
          <SettingsRow
            icon="notifications-outline"
            label="Notifications"
            onPress={() => {}}
          />
          <SettingsRow
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() => setHelpExpanded((v) => !v)}
            trailing={
              <Ionicons
                name={helpExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={Colors.textTertiary}
              />
            }
          />
          {helpExpanded && (
            <View style={styles.helpInline}>
              <Ionicons
                name="mail-outline"
                size={14}
                color={Colors.textSecondary}
              />
              <Text style={styles.helpInlineText}>hello@coterieapp.co</Text>
            </View>
          )}
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* 6. Sign out                                                       */}
        {/* ---------------------------------------------------------------- */}
        <View style={styles.signOutSection}>
          <TouchableOpacity
            style={[
              styles.signOutButton,
              confirmingSignOut && styles.signOutButtonConfirming,
            ]}
            onPress={handleSignOut}
            disabled={signOutLoading}
            activeOpacity={0.8}
          >
            {signOutLoading ? (
              <ActivityIndicator
                size="small"
                color={confirmingSignOut ? Colors.textPrimary : Colors.error}
              />
            ) : (
              <Ionicons
                name="log-out-outline"
                size={18}
                color={confirmingSignOut ? Colors.textPrimary : Colors.error}
              />
            )}
            <Text
              style={[
                styles.signOutButtonText,
                confirmingSignOut && styles.signOutButtonTextConfirming,
              ]}
            >
              {confirmingSignOut ? 'Confirm sign out' : 'Sign Out'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      {user && profile && (
        <EditProfileModal
          visible={editModalVisible}
          onClose={() => setEditModalVisible(false)}
          userId={user.id}
          initialValues={{
            displayName: profile.first_name ?? profile.display_name ?? '',
            bio: profile.bio ?? '',
            age: profile.age ? String(profile.age) : '',
            neighborhood: profile.neighborhood ?? '',
            travelRadius: (RADIUS_OPTIONS.includes(profile.travel_radius_km as RadiusOption)
              ? profile.travel_radius_km
              : 10) as RadiusOption,
          }}
          initialPrompts={prompts}
          avatarUrl={profile.avatar_url}
          onSaved={async (updatedPrompts) => {
            await refreshProfile();
            setPrompts(updatedPrompts);
            setEditModalVisible(false);
          }}
          onAvatarPress={handleAvatarPress}
          uploading={uploading}
        />
      )}

      {/* Profile Preview Modal */}
      {profile && (
        <ProfilePreviewModal
          visible={previewModalVisible}
          onClose={() => setPreviewModalVisible(false)}
          displayName={profile.first_name ?? profile.display_name ?? ''}
          age={profile.age ?? null}
          neighborhood={profile.neighborhood ?? null}
          bio={profile.bio ?? null}
          avatarUrl={profile.avatar_url ?? null}
          prompts={prompts}
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Settings row
// ---------------------------------------------------------------------------

function SettingsRow({
  icon,
  label,
  onPress,
  trailing,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      style={styles.settingsRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.settingsRowIcon}>
        <Ionicons name={icon} size={18} color={Colors.textSecondary} />
      </View>
      <Text style={styles.settingsRowLabel}>{label}</Text>
      {trailing ?? (
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      )}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Profile preview modal
// ---------------------------------------------------------------------------

interface ProfilePreviewModalProps {
  visible: boolean;
  onClose: () => void;
  displayName: string;
  age: number | null;
  neighborhood: string | null;
  bio: string | null;
  avatarUrl: string | null;
  prompts: PromptsMap;
}

function ProfilePreviewModal({
  visible,
  onClose,
  displayName,
  age,
  neighborhood,
  bio,
  avatarUrl,
  prompts,
}: ProfilePreviewModalProps) {
  const promptEntries = PROMPT_KEYS.map((key) => prompts[key]).filter(
    (p): p is PromptData => !!p
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={previewStyles.container}>
        {/* Close button */}
        <View style={previewStyles.header}>
          <View style={previewStyles.headerSpacer} />
          <Text style={previewStyles.headerTitle}>Profile Preview</Text>
          <TouchableOpacity
            style={previewStyles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={previewStyles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar */}
          <View style={previewStyles.avatarWrapper}>
            <Avatar
              name={displayName || '?'}
              imageUrl={avatarUrl}
              size="xl"
            />
          </View>

          {/* Name + age */}
          <View style={previewStyles.nameRow}>
            <Text style={previewStyles.displayName}>{displayName}</Text>
            {age ? (
              <Text style={previewStyles.agePill}>{age}</Text>
            ) : null}
          </View>

          {/* Neighborhood */}
          {neighborhood ? (
            <View style={previewStyles.neighborhoodRow}>
              <Text style={previewStyles.neighborhoodIcon}>📍</Text>
              <Text style={previewStyles.neighborhoodText}>{neighborhood}</Text>
            </View>
          ) : null}

          {/* Bio */}
          {bio ? (
            <Text style={previewStyles.bioText}>{bio}</Text>
          ) : null}

          {/* Prompts */}
          {promptEntries.length > 0 && (
            <View style={previewStyles.promptsSection}>
              {promptEntries.slice(0, 3).map((prompt, i) => (
                <View key={i} style={previewStyles.promptCard}>
                  <Text style={previewStyles.promptQuestion}>
                    {prompt.question}
                  </Text>
                  <Text style={previewStyles.promptAnswer}>
                    {prompt.answer}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Privacy notice */}
          <View style={previewStyles.privacyNotice}>
            <Text style={previewStyles.privacyNoticeText}>
              🔒 Your full profile is only revealed to group members{' '}
              <Text style={previewStyles.privacyNoticeBold}>
                after you check in
              </Text>{' '}
              at your first event together.
            </Text>
          </View>

          <Text style={previewStyles.footerNote}>
            This is how your profile appears to other Squad members.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Edit profile modal
// ---------------------------------------------------------------------------

const RADIUS_OPTIONS = [5, 10, 15, 20, 30] as const;
type RadiusOption = typeof RADIUS_OPTIONS[number];

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  initialValues: {
    displayName: string;
    bio: string;
    age: string;
    neighborhood: string;
    travelRadius: RadiusOption;
  };
  initialPrompts: PromptsMap;
  avatarUrl: string | null | undefined;
  onSaved: (updatedPrompts: PromptsMap) => Promise<void>;
  onAvatarPress: () => void;
  uploading: boolean;
}

function EditProfileModal({
  visible,
  onClose,
  userId,
  initialValues,
  initialPrompts,
  avatarUrl,
  onSaved,
  onAvatarPress,
  uploading,
}: EditProfileModalProps) {
  const [displayName, setDisplayName] = useState(initialValues.displayName);
  const [bio, setBio] = useState(initialValues.bio);
  const [age, setAge] = useState(initialValues.age);
  const [neighborhood, setNeighborhood] = useState(initialValues.neighborhood);
  const [travelRadius, setTravelRadius] = useState<RadiusOption>(initialValues.travelRadius);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Prompt slots: questionIndex + answer text
  const [promptSlots, setPromptSlots] = useState<
    Array<{ questionIndex: number; answer: string }>
  >([
    { questionIndex: 0, answer: '' },
    { questionIndex: 1, answer: '' },
    { questionIndex: 2, answer: '' },
  ]);

  // Sync when modal opens
  useEffect(() => {
    if (visible) {
      setDisplayName(initialValues.displayName);
      setBio(initialValues.bio);
      setAge(initialValues.age);
      setNeighborhood(initialValues.neighborhood);
      setTravelRadius(initialValues.travelRadius);
      setSaveError(null);

      const newSlots = PROMPT_KEYS.map((key, i) => {
        const stored = initialPrompts[key];
        if (stored) {
          const qi = PROMPT_QUESTIONS.indexOf(stored.question);
          return {
            questionIndex: qi >= 0 ? qi : i,
            answer: stored.answer,
          };
        }
        return { questionIndex: i, answer: '' };
      });
      setPromptSlots(newSlots);
    }
  }, [visible, initialValues, initialPrompts]);

  const cycleQuestion = (slotIndex: number, direction: 1 | -1) => {
    setPromptSlots((prev) => {
      const next = [...prev];
      const current = next[slotIndex].questionIndex;
      next[slotIndex] = {
        ...next[slotIndex],
        questionIndex:
          (current + direction + PROMPT_QUESTIONS.length) %
          PROMPT_QUESTIONS.length,
      };
      return next;
    });
  };

  const setPromptAnswer = (slotIndex: number, answer: string) => {
    setPromptSlots((prev) => {
      const next = [...prev];
      next[slotIndex] = { ...next[slotIndex], answer };
      return next;
    });
  };

  async function handleSave() {
    if (!displayName.trim()) {
      setSaveError('First name is required.');
      return;
    }
    setSaveError(null);
    setIsSaving(true);

    try {
      const { error: profileError } = await updateProfile(userId, {
        first_name: displayName.trim(),
        bio: bio.trim() || null,
        age: age ? parseInt(age, 10) : null,
        neighborhood: neighborhood.trim() || null,
        travel_radius_km: travelRadius,
      });

      if (profileError) {
        setSaveError(profileError);
        return;
      }

      // Upsert filled prompt slots
      const promptUpserts = promptSlots
        .map((slot, i) =>
          slot.answer.trim()
            ? {
                user_id: userId,
                question_key: PROMPT_KEYS[i],
                answer: {
                  question: PROMPT_QUESTIONS[slot.questionIndex],
                  answer: slot.answer.trim(),
                },
                updated_at: new Date().toISOString(),
              }
            : null
        )
        .filter(Boolean) as Array<{
          user_id: string;
          question_key: string;
          answer: object;
          updated_at: string;
        }>;

      if (promptUpserts.length > 0) {
        const { error: promptError } = await supabase
          .from('questionnaire_answers')
          .upsert(promptUpserts, { onConflict: 'user_id,question_key' });

        if (promptError) {
          setSaveError(promptError.message);
          return;
        }
      }

      // Delete cleared slots
      const clearedKeys = promptSlots
        .filter((slot) => !slot.answer.trim())
        .map((_, i) => PROMPT_KEYS[i]);

      if (clearedKeys.length > 0) {
        await supabase
          .from('questionnaire_answers')
          .delete()
          .eq('user_id', userId)
          .in('question_key', clearedKeys);
      }

      // Build updated prompts map to hand back to parent
      const updatedPrompts: PromptsMap = {};
      promptSlots.forEach((slot, i) => {
        if (slot.answer.trim()) {
          updatedPrompts[PROMPT_KEYS[i]] = {
            question: PROMPT_QUESTIONS[slot.questionIndex],
            answer: slot.answer.trim(),
          };
        }
      });

      await onSaved(updatedPrompts);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={modalStyles.container}>
        {/* Header */}
        <View style={modalStyles.header}>
          <TouchableOpacity onPress={onClose} style={modalStyles.headerSide}>
            <Text style={modalStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={modalStyles.headerTitle}>Edit Profile</Text>
          <View style={modalStyles.headerSide} />
        </View>

        <ScrollView
          contentContainerStyle={modalStyles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar row */}
          <TouchableOpacity
            style={modalStyles.avatarRow}
            onPress={onAvatarPress}
            activeOpacity={0.8}
          >
            <View style={modalStyles.avatarThumb}>
              <Avatar
                name={displayName || '?'}
                imageUrl={avatarUrl}
                size="lg"
              />
              <View style={modalStyles.avatarBadge}>
                {uploading ? (
                  <ActivityIndicator size="small" color={Colors.textPrimary} />
                ) : (
                  <Ionicons name="camera" size={11} color={Colors.textPrimary} />
                )}
              </View>
            </View>
            <Text style={modalStyles.avatarChangeText}>Change photo</Text>
          </TouchableOpacity>

          <View style={modalStyles.divider} />

          {/* First name */}
          <View style={modalStyles.fieldGroup}>
            <Text style={modalStyles.fieldLabel}>First Name</Text>
            <TextInput
              style={modalStyles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your first name"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="words"
              selectionColor={Colors.accent}
            />
          </View>

          {/* Bio */}
          <View style={modalStyles.fieldGroup}>
            <Text style={modalStyles.fieldLabel}>Bio</Text>
            <TextInput
              style={[modalStyles.input, modalStyles.inputMultiline]}
              value={bio}
              onChangeText={(v) => setBio(v.slice(0, 200))}
              placeholder="Tell your group a bit about yourself\u2026"
              placeholderTextColor={Colors.textTertiary}
              multiline
              maxLength={200}
              selectionColor={Colors.accent}
            />
            <Text style={modalStyles.charCount}>{bio.length}/200</Text>
          </View>

          {/* Age */}
          <View style={modalStyles.fieldGroup}>
            <Text style={modalStyles.fieldLabel}>Age</Text>
            <TextInput
              style={modalStyles.input}
              value={age}
              onChangeText={(v) => setAge(v.replace(/[^0-9]/g, ''))}
              placeholder="Your age"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="number-pad"
              maxLength={3}
              selectionColor={Colors.accent}
            />
          </View>

          {/* Neighborhood */}
          <View style={modalStyles.fieldGroup}>
            <Text style={modalStyles.fieldLabel}>Neighborhood</Text>
            <TextInput
              style={modalStyles.input}
              value={neighborhood}
              onChangeText={setNeighborhood}
              placeholder="e.g. Brooklyn, NY"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="words"
              selectionColor={Colors.accent}
            />
          </View>

          {/* Travel radius */}
          <View style={modalStyles.fieldGroup}>
            <Text style={modalStyles.fieldLabel}>How far will you travel?</Text>
            <View style={modalStyles.radiusRow}>
              {RADIUS_OPTIONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setTravelRadius(r)}
                  style={[
                    modalStyles.radiusPill,
                    travelRadius === r && modalStyles.radiusPillActive,
                  ]}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      modalStyles.radiusPillText,
                      travelRadius === r && modalStyles.radiusPillTextActive,
                    ]}
                  >
                    {r} km
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={modalStyles.divider} />

          {/* Prompts */}
          <Text style={modalStyles.promptsHeading}>Your Prompts</Text>
          <Text style={modalStyles.promptsSubheading}>
            Let people get to know the real you.
          </Text>

          {promptSlots.map((slot, i) => (
            <View key={i} style={modalStyles.promptSlot}>
              {/* Question picker */}
              <View style={modalStyles.promptPickerRow}>
                <TouchableOpacity
                  onPress={() => cycleQuestion(i, -1)}
                  style={modalStyles.promptArrow}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="chevron-back"
                    size={16}
                    color={Colors.accent}
                  />
                </TouchableOpacity>
                <Text
                  style={modalStyles.promptQuestionText}
                  numberOfLines={2}
                >
                  {PROMPT_QUESTIONS[slot.questionIndex]}
                </Text>
                <TouchableOpacity
                  onPress={() => cycleQuestion(i, 1)}
                  style={modalStyles.promptArrow}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={Colors.accent}
                  />
                </TouchableOpacity>
              </View>
              {/* Answer */}
              <TextInput
                style={[modalStyles.input, modalStyles.promptAnswerInput]}
                value={slot.answer}
                onChangeText={(v) => setPromptAnswer(i, v)}
                placeholder="Your answer\u2026"
                placeholderTextColor={Colors.textTertiary}
                multiline
                maxLength={200}
                selectionColor={Colors.accent}
              />
            </View>
          ))}

          {/* Inline error */}
          {saveError ? (
            <View style={modalStyles.errorBox}>
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color={Colors.error}
              />
              <Text style={modalStyles.errorText}>{saveError}</Text>
            </View>
          ) : null}

          {/* Save button */}
          <TouchableOpacity
            style={[
              modalStyles.saveButton,
              isSaving && modalStyles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={Colors.textPrimary} />
            ) : (
              <Text style={modalStyles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles — main screen
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },

  // ---- Header ----
  headerSection: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: Spacing.xs,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  displayName: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  agePill: {
    ...Typography.label,
    color: Colors.textSecondary,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  nicknameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 2,
  },
  nicknameLabel: {
    ...Typography.bodySmall,
    color: Colors.accent,
    fontWeight: '600',
  },
  nicknameHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  neighborhoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  neighborhoodIcon: {
    fontSize: 13,
  },
  neighborhoodText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  bioText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  profileButtonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: Radius.full,
    paddingVertical: 7,
    paddingHorizontal: Spacing.md,
  },
  editProfileButtonText: {
    ...Typography.label,
    color: Colors.accent,
  },
  previewProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingVertical: 7,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
  },
  previewProfileButtonText: {
    ...Typography.label,
    color: Colors.textSecondary,
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  privacyIcon: {
    fontSize: 13,
    marginTop: 1,
  },
  privacyText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },

  // ---- Section ----
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.label,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },

  // ---- Prompt cards ----
  promptCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    minHeight: 80,
    position: 'relative',
  },
  promptQuestion: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  promptAnswer: {
    ...Typography.body,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  promptEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  promptAddIcon: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptEmptyText: {
    ...Typography.body,
    color: Colors.textTertiary,
  },
  promptEditBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
  },

  // ---- Stats card ----
  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  statLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },

  // ---- History ----
  emptyCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  emptyCardText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 260,
  },
  historyItem: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
    alignItems: 'center',
  },
  historyIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  historyInfo: {
    flex: 1,
    gap: 2,
  },
  historyGroupName: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  historyVenue: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  historyDate: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },

  // ---- Settings ----
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  settingsRowIcon: {
    width: 28,
    alignItems: 'center',
  },
  settingsRowLabel: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
  },
  helpInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    marginTop: -Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  helpInlineText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },

  // ---- Sign out ----
  signOutSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.error,
    backgroundColor: 'transparent',
  },
  signOutButtonConfirming: {
    backgroundColor: Colors.error,
    borderColor: Colors.error,
  },
  signOutButtonText: {
    ...Typography.body,
    color: Colors.error,
    fontWeight: '600',
  },
  signOutButtonTextConfirming: {
    color: Colors.textPrimary,
  },
});

// ---------------------------------------------------------------------------
// Styles — edit profile modal
// ---------------------------------------------------------------------------

const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerSide: {
    minWidth: 60,
  },
  headerTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    textAlign: 'center',
    flex: 1,
  },
  cancelText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },

  // Avatar row
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  avatarThumb: {
    position: 'relative',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  avatarChangeText: {
    ...Typography.body,
    color: Colors.accent,
    fontWeight: '500',
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },

  // Fields
  fieldGroup: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    ...Typography.body,
    color: Colors.textPrimary,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginTop: 2,
  },

  // Prompts
  promptsHeading: {
    ...Typography.h4,
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },
  promptsSubheading: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.xs,
  },
  promptSlot: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  promptPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.xs,
  },
  promptArrow: {
    padding: Spacing.xs,
  },
  promptQuestionText: {
    ...Typography.label,
    color: Colors.accent,
    flex: 1,
    textAlign: 'center',
  },
  promptAnswerInput: {
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    minHeight: 64,
    paddingTop: Spacing.sm,
  },

  // Travel radius pills
  radiusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: 4,
  },
  radiusPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  radiusPillActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentLight,
  },
  radiusPillText: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  radiusPillTextActive: {
    color: Colors.accent,
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.error,
    flex: 1,
  },

  // Save button
  saveButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
});

// ---------------------------------------------------------------------------
// Styles — profile preview modal
// ---------------------------------------------------------------------------

const previewStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerSpacer: {
    width: 32,
  },
  headerTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  content: {
    alignItems: 'center',
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  avatarWrapper: {
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  displayName: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  agePill: {
    ...Typography.label,
    color: Colors.textSecondary,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  neighborhoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.sm,
  },
  neighborhoodIcon: {
    fontSize: 13,
  },
  neighborhoodText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  bioText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
    marginBottom: Spacing.md,
  },
  promptsSection: {
    width: '100%',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  promptCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    width: '100%',
  },
  promptQuestion: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  promptAnswer: {
    ...Typography.body,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  privacyNotice: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginTop: Spacing.xl,
    width: '100%',
  },
  privacyNoticeText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
  privacyNoticeBold: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  footerNote: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
