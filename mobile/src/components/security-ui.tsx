import type { LucideIcon } from 'lucide-react-native';
import { ArrowLeft, ClipboardList, Home, ScanLine, Shield, UserRound } from 'lucide-react-native';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export const colors = {
  navy: '#102442',
  navyDeep: '#0B1B34',
  blue: '#2369E8',
  blueSoft: '#EAF1FF',
  canvas: '#F4F7FB',
  white: '#FFFFFF',
  ink: '#192B45',
  muted: '#718096',
  line: '#E4EAF2',
  green: '#16875D',
  greenSoft: '#E8F7F0',
  red: '#D93A46',
  redSoft: '#FFF0F0',
  amber: '#A46510',
  amberSoft: '#FFF5E5',
};

export function AppText({ children, style, ...props }: ComponentProps<typeof Text>) {
  return <Text {...props} style={[styles.text, style]}>{children}</Text>;
}

export function IconBox({ icon: Icon, color = colors.blue, size = 21, background = colors.blueSoft }: {
  icon: LucideIcon;
  color?: string;
  size?: number;
  background?: string;
}) {
  return <View style={[styles.iconBox, { backgroundColor: background }]}><Icon color={color} size={size} strokeWidth={2.1} /></View>;
}

export function Page({ title, subtitle, children, back = true, bottomNav = false, right }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  back?: boolean;
  bottomNav?: boolean;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.page}>
        <View style={styles.header}>
          {back ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/dashboard');
            }} style={styles.headerBack}>
              <ArrowLeft size={21} color={colors.ink} />
            </Pressable>
          ) : <View accessibilityLabel="Campus Security" style={styles.headerBack}><Shield size={21} color={colors.blue} /></View>}
          <View style={styles.headerCopy}>
            <AppText style={styles.headerTitle}>{title}</AppText>
            {subtitle ? <AppText style={styles.headerSubtitle}>{subtitle}</AppText> : null}
          </View>
          {right ?? <View style={styles.headerSpacer} />}
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>{children}</View>
        </ScrollView>
        {bottomNav ? <BottomNav /> : null}
        <View style={{ height: Math.max(insets.bottom, 8) }} />
      </View>
    </SafeAreaView>
  );
}

export function BottomNav() {
  const items = [
    { label: 'Home', route: '/dashboard', icon: Home },
    { label: 'History', route: '/history', icon: ClipboardList },
    { label: 'Scan', route: '/scan', icon: ScanLine },
    { label: 'Profile', route: '/profile', icon: UserRound },
  ] as const;
  return (
    <View style={styles.bottomNav}>
      {items.map(({ label, route, icon: Icon }) => (
        <Pressable key={route} accessibilityRole="button" onPress={() => router.replace(route)} style={styles.navItem}>
          <Icon color={colors.muted} size={20} strokeWidth={2} />
          <AppText style={styles.navLabel}>{label}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return <View style={styles.sectionTitle}><AppText style={styles.sectionTitleText}>{children}</AppText>{right}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({ label, onPress, icon: Icon, variant = 'primary', disabled = false }: {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  disabled?: boolean;
}) {
  const buttonStyle = variant === 'danger' ? styles.buttonDanger : variant === 'secondary' ? styles.buttonSecondary : variant === 'outline' ? styles.buttonOutline : styles.buttonPrimary;
  const textStyle = variant === 'secondary' ? styles.buttonSecondaryText : variant === 'outline' ? styles.buttonOutlineText : styles.buttonText;
  const iconColor = variant === 'secondary' ? colors.blue : variant === 'outline' ? colors.ink : colors.white;
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, buttonStyle, pressed && styles.pressed, disabled && styles.disabled]}>
      {Icon ? <Icon size={18} color={iconColor} strokeWidth={2.2} /> : null}
      <AppText style={textStyle}>{label}</AppText>
    </Pressable>
  );
}

export function Field({ label, value, onChangeText, placeholder, keyboardType, secureTextEntry, right, multiline = false, autoCapitalize }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: ComponentProps<typeof TextInput>['keyboardType'];
  secureTextEntry?: boolean;
  right?: ReactNode;
  multiline?: boolean;
  autoCapitalize?: ComponentProps<typeof TextInput>['autoCapitalize'];
}) {
  return (
    <View style={styles.fieldWrap}>
      <AppText style={styles.fieldLabel}>{label}</AppText>
      <View style={[styles.inputShell, multiline && styles.multilineShell]}>
        <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9AA7B8" keyboardType={keyboardType} secureTextEntry={secureTextEntry} multiline={multiline} autoCapitalize={autoCapitalize} style={[styles.input, multiline && styles.multilineInput]} />
        {right}
      </View>
    </View>
  );
}

export function Pill({ label, tone = 'blue' }: { label: string; tone?: 'blue' | 'green' | 'red' | 'amber' | 'gray' }) {
  const toneStyle = tone === 'green' ? styles.pillGreen : tone === 'red' ? styles.pillRed : tone === 'amber' ? styles.pillAmber : tone === 'gray' ? styles.pillGray : styles.pillBlue;
  const textStyle = tone === 'green' ? styles.pillGreenText : tone === 'red' ? styles.pillRedText : tone === 'amber' ? styles.pillAmberText : tone === 'gray' ? styles.pillGrayText : styles.pillBlueText;
  return <View style={[styles.pill, toneStyle]}><AppText style={[styles.pillText, textStyle]}>{label}</AppText></View>;
}

export function Notice({ children, tone = 'blue' }: { children: ReactNode; tone?: 'blue' | 'red' | 'green' }) {
  const noticeStyle = tone === 'red' ? styles.noticeRed : tone === 'green' ? styles.noticeGreen : styles.noticeBlue;
  const noticeText = tone === 'red' ? styles.noticeRedText : tone === 'green' ? styles.noticeGreenText : styles.noticeBlueText;
  return <View style={[styles.notice, noticeStyle]}><AppText style={[styles.noticeText, noticeText]}>{children}</AppText></View>;
}

export function ChoiceChips({ values, selected, onSelect }: {
  values: readonly string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return <View style={styles.chipRow}>{values.map(value => (
    <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: value === selected }} onPress={() => onSelect(value)} style={[styles.chip, value === selected && styles.chipSelected]}>
      <AppText style={[styles.chipText, value === selected && styles.chipSelectedText]}>{value}</AppText>
    </Pressable>
  ))}</View>;
}

export function ConfirmDialog({ visible, title, message, confirmLabel, onConfirm, onCancel, danger = false }: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={styles.modalShade}>
        <View style={styles.dialog}>
          <AppText style={styles.dialogTitle}>{title}</AppText>
          <AppText style={styles.dialogMessage}>{message}</AppText>
          <Button label={confirmLabel} onPress={onConfirm} variant={danger ? 'danger' : 'primary'} />
          <Button label="Cancel" onPress={onCancel} variant="outline" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  page: { flex: 1, backgroundColor: colors.canvas },
  header: { minHeight: 66, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 12 },
  headerBack: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.canvas },
  headerCopy: { flex: 1 },
  headerTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  headerSubtitle: { color: colors.muted, fontSize: 11, marginTop: 2 },
  headerSpacer: { width: 36 },
  scrollContent: { alignItems: 'center', paddingBottom: 18 },
  content: { width: '100%', maxWidth: 560, paddingHorizontal: 20, paddingTop: 20, gap: 16 },
  text: { color: colors.ink, fontSize: 14, lineHeight: 20, fontFamily: 'System' },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitleText: { fontSize: 16, fontWeight: '700', color: colors.ink },
  card: { backgroundColor: colors.white, borderRadius: 18, padding: 17, borderWidth: 1, borderColor: '#EDF1F6', shadowColor: '#213552', shadowOpacity: 0.045, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  bottomNav: { minHeight: 64, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 10 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 56 },
  navLabel: { fontSize: 10, color: colors.muted, fontWeight: '600' },
  button: { minHeight: 50, borderRadius: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 },
  buttonPrimary: { backgroundColor: colors.blue },
  buttonDanger: { backgroundColor: colors.red },
  buttonSecondary: { backgroundColor: colors.blueSoft },
  buttonOutline: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  buttonText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  buttonSecondaryText: { color: colors.blue, fontSize: 14, fontWeight: '700' },
  buttonOutlineText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.5 },
  fieldWrap: { gap: 8 },
  fieldLabel: { color: colors.ink, fontWeight: '600', fontSize: 13 },
  inputShell: { minHeight: 50, borderRadius: 13, paddingHorizontal: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minHeight: 46, paddingVertical: 10, color: colors.ink, fontSize: 14 },
  multilineShell: { minHeight: 96, alignItems: 'flex-start' },
  multilineInput: { minHeight: 90, textAlignVertical: 'top' },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  pillText: { fontSize: 10, fontWeight: '700' },
  pillBlue: { backgroundColor: colors.blueSoft },
  pillBlueText: { color: colors.blue },
  pillGreen: { backgroundColor: colors.greenSoft },
  pillGreenText: { color: colors.green },
  pillRed: { backgroundColor: colors.redSoft },
  pillRedText: { color: colors.red },
  pillAmber: { backgroundColor: colors.amberSoft },
  pillAmberText: { color: colors.amber },
  pillGray: { backgroundColor: '#EFF2F6' },
  pillGrayText: { color: '#65758A' },
  notice: { padding: 12, borderRadius: 12, borderWidth: 1 },
  noticeText: { fontSize: 12, lineHeight: 18, fontWeight: '500' },
  noticeBlue: { backgroundColor: colors.blueSoft, borderColor: '#D7E4FF' },
  noticeBlueText: { color: '#31598F' },
  noticeRed: { backgroundColor: colors.redSoft, borderColor: '#F6D3D5' },
  noticeRedText: { color: '#9C2E36' },
  noticeGreen: { backgroundColor: colors.greenSoft, borderColor: '#C8EDDA' },
  noticeGreenText: { color: '#236B4F' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  chipSelected: { backgroundColor: colors.blueSoft, borderColor: colors.blue },
  chipText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  chipSelectedText: { color: colors.blue },
  modalShade: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(8, 23, 43, 0.55)' },
  dialog: { width: '100%', maxWidth: 380, gap: 14, backgroundColor: colors.white, padding: 22, borderRadius: 20 },
  dialogTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  dialogMessage: { color: colors.muted, fontSize: 13, lineHeight: 20 },
});
