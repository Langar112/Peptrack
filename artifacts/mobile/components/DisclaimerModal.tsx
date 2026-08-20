import React, { useState, useEffect } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface DisclaimerModalProps {
  visible: boolean;
  onAccept?: () => void;
  onDecline: () => void;
  readOnly?: boolean;
}

export function DisclaimerModal({ visible, onAccept, onDecline, readOnly = false }: DisclaimerModalProps) {
  const colors = useColors();
  const [checked, setChecked] = useState(false);

  // Reset checkbox every time the modal opens so a new user never inherits a prior session's tick
  useEffect(() => {
    if (visible) setChecked(false);
  }, [visible]);

  const handleAccept = () => {
    if (readOnly) return;
    if (!checked) return;
    onAccept?.();
  };

  const handleDecline = () => {
    setChecked(false);
    onDecline();
  };

  const s = makeStyles(colors);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleDecline}
    >
      <View style={[s.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <View style={[s.iconWrap, { backgroundColor: colors.primary + '18' }]}>
            <Feather name="alert-triangle" size={22} color={colors.primary} />
          </View>
          <Text style={[s.title, { color: colors.foreground }]}>Safety Disclaimer</Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            {readOnly ? 'Review the information before using the app' : 'Please read before saving your first cycle'}
          </Text>
        </View>

        {/* Body */}
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={[s.bodyHeading, { color: colors.foreground }]}>For Research & Educational Use Only</Text>
          <Text style={[s.body, { color: colors.mutedForeground }]}>
            PeptidePro is designed as a research and educational tool to help users track
            and log information about peptide compounds. It is{' '}
            <Text style={{ fontFamily: 'Inter_700Bold', color: colors.foreground }}>
              not a medical application
            </Text>{' '}
            and does not provide medical advice, diagnosis, or treatment.
          </Text>

          <Text style={[s.bodyHeading, { color: colors.foreground }]}>Not a Substitute for Medical Advice</Text>
          <Text style={[s.body, { color: colors.mutedForeground }]}>
            Nothing in this app should be interpreted as a recommendation to use any
            compound. Always consult a qualified healthcare professional before starting,
            stopping, or altering any substance protocol.
          </Text>

          <Text style={[s.bodyHeading, { color: colors.foreground }]}>Regulatory Compliance</Text>
          <Text style={[s.body, { color: colors.mutedForeground }]}>
            The legal status of peptide compounds varies by country and jurisdiction. It
            is your sole responsibility to ensure that any activities you log comply with
            all applicable local laws and regulations.
          </Text>

          <Text style={[s.bodyHeading, { color: colors.foreground }]}>Limitation of Liability</Text>
          <Text style={[s.body, { color: colors.mutedForeground }]}>
            The developers of PeptidePro accept no liability for any harm, adverse
            effects, or legal consequences arising from the use of information logged in
            this app. You use this application entirely at your own risk.
          </Text>

          {!readOnly && (
            <TouchableOpacity
              style={[s.checkRow, { backgroundColor: colors.card, borderColor: checked ? colors.primary : colors.border }]}
              onPress={() => setChecked((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={[s.checkbox, { borderColor: checked ? colors.primary : colors.border, backgroundColor: checked ? colors.primary : 'transparent' }]}>
                {checked && <Feather name="check" size={12} color={colors.primaryForeground} />}
              </View>
              <Text style={[s.checkLabel, { color: colors.foreground }]}>
                I understand this app is for research and educational purposes only, and I
                accept full responsibility for my use of this information.
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Footer buttons */}
        <View style={[s.footer, { borderTopColor: colors.border }]}>
          {readOnly ? (
            <TouchableOpacity
              style={[s.acceptBtn, { backgroundColor: colors.primary }]}
              onPress={handleDecline}
              activeOpacity={0.8}
              testID="disclaimer-close-button"
            >
              <Text style={[s.acceptBtnText, { color: colors.primaryForeground }]}>Close</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={[s.declineBtn, { borderColor: colors.border }]} onPress={handleDecline}>
                <Text style={[s.declineBtnText, { color: colors.mutedForeground }]}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.acceptBtn, { backgroundColor: checked ? colors.primary : colors.muted }]}
                onPress={handleAccept}
                disabled={!checked}
                activeOpacity={0.8}
              >
                <Text style={[s.acceptBtnText, { color: checked ? colors.primaryForeground : colors.mutedForeground }]}>
                  I Agree &amp; Continue
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      alignItems: 'center',
      paddingTop: 28,
      paddingBottom: 20,
      paddingHorizontal: 24,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: 8,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    title: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center' },
    subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
    scroll: { flex: 1 },
    scrollContent: { padding: 24, paddingBottom: 16 },
    bodyHeading: { fontSize: 14, fontFamily: 'Inter_700Bold', marginBottom: 6, marginTop: 16 },
    body: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginTop: 24,
      padding: 16,
      borderRadius: colors.radius,
      borderWidth: 1.5,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
      flexShrink: 0,
    },
    checkLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 21 },
    footer: {
      flexDirection: 'row',
      gap: 12,
      padding: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    declineBtn: {
      flex: 1,
      paddingVertical: 15,
      borderRadius: colors.radius,
      borderWidth: 1.5,
      alignItems: 'center',
    },
    declineBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
    acceptBtn: {
      flex: 2,
      paddingVertical: 15,
      borderRadius: colors.radius,
      alignItems: 'center',
    },
    acceptBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  });
}
