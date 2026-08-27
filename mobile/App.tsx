import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Appearance, KeyboardAvoidingView, Linking, Platform,
  Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import { darkTheme, lightTheme, type AppTheme } from './src/theme';
import type { CreditReport, Message, Payment, Profile, ResolutionRequest } from './src/types';

type Tab = 'home' | 'report' | 'new' | 'requests' | 'profile';
type AuthMode = 'password' | 'otp' | 'signup' | 'reset';
type EmailOtpType = 'email' | 'signup' | 'recovery';

const CURRENT_APP_VERSION = '1.0.13';
const UPDATE_MANIFEST_URL = 'https://savrdhfinancialservices.com/api/mobile/latest';

function isNewerVersion(latest: string, current: string) {
  const a = latest.split('.').map((part) => Number(part) || 0);
  const b = current.split('.').map((part) => Number(part) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}

export default function App() {
  const systemDark = Appearance.getColorScheme() === 'dark';
  const [dark, setDark] = useState(systemDark);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    const openAuthUrl = async (url: string | null) => {
      if (!url || !url.startsWith('savrdhcredit://')) return;
      const fragment = url.split('#')[1] || '';
      const params = new URLSearchParams(fragment);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) Alert.alert('Verification failed', error.message);
      }
    };
    Linking.getInitialURL().then(openAuthUrl);
    const link = Linking.addEventListener('url', ({ url }) => openAuthUrl(url));
    return () => { data.subscription.unsubscribe(); link.remove(); };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    fetch(UPDATE_MANIFEST_URL)
      .then((response) => response.ok ? response.json() : null)
      .then((release) => {
        if (!release?.version || !release?.apkUrl || !isNewerVersion(release.version, CURRENT_APP_VERSION)) return;
        Alert.alert(
          'New SAVRDH update available',
          `Version ${release.version} is ready. Download and install the latest secure release now.`,
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Update Now', onPress: () => Linking.openURL(release.apkUrl) },
          ],
        );
      })
      .catch(() => undefined);
  }, []);

  const theme = dark ? darkTheme : lightTheme;
  if (loading) return <Splash theme={theme} />;
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {session ? <CustomerApp session={session} theme={theme} dark={dark} setDark={setDark} /> : <Auth theme={theme} dark={dark} setDark={setDark} />}
    </View>
  );
}

function Splash({ theme }: { theme: AppTheme }) {
  return <View style={[styles.center, { backgroundColor: theme.bg }]}><Brand theme={theme} /><ActivityIndicator color={theme.primary} /></View>;
}

function Auth({ theme, dark, setDark }: { theme: AppTheme; dark: boolean; setDark: (v: boolean) => void }) {
  const [mode, setMode] = useState<AuthMode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpType, setOtpType] = useState<EmailOtpType>('email');
  const [resetVerified, setResetVerified] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim()) return Alert.alert('Email required');
    setBusy(true);
    try {
      if (mode === 'otp') {
        if (!otpSent) {
          const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: false } });
          if (error) throw error;
          setOtpType('email');
          setOtpSent(true);
          Alert.alert('OTP sent', '6-digit SAVRDH verification code aapke registered email par bheja gaya hai.');
        } else {
          if (otp.length !== 6) throw new Error('Enter the 6-digit OTP.');
          const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: otp, type: otpType });
          if (error) throw error;
        }
      } else if (mode === 'signup') {
        if (password.length < 8 || !name.trim()) throw new Error('Enter your name and a password of at least 8 characters.');
        const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { full_name: name.trim(), mobile: mobile.trim() } } });
        if (error) throw error;
        setOtpType('signup'); setMode('otp'); setOtpSent(true);
        Alert.alert('Account created', data.session ? 'Welcome to SAVRDH.' : '6-digit verification code email par bheja gaya hai. Code enter karke account activate karein.');
      } else if (mode === 'reset') {
        if (!otpSent) {
          const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
          if (error) throw error;
          setOtpType('recovery');
          setOtpSent(true);
          Alert.alert('Reset code sent', 'Email mein mila 6-digit recovery code enter karein.');
        } else if (!resetVerified) {
          if (otp.length !== 6) throw new Error('Enter the 6-digit reset OTP.');
          const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: otp, type: 'recovery' });
          if (error) throw error;
          setResetVerified(true); setPassword('');
        } else {
          if (password.length < 8) throw new Error('New password must be at least 8 characters.');
          const { error } = await supabase.auth.updateUser({ password });
          if (error) throw error;
          await supabase.auth.signOut();
          setMode('password'); setOtpSent(false); setResetVerified(false); setOtp(''); setPassword('');
          Alert.alert('Password updated', 'Ab naye password se sign in karein.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) throw error;
      }
    } catch (e) { Alert.alert('Unable to continue', messageOf(e)); }
    finally { setBusy(false); }
  }

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={[styles.authWrap, { backgroundColor: theme.bg }]} keyboardShouldPersistTaps="handled">
      <View style={styles.topActions}><ThemeToggle dark={dark} setDark={setDark} theme={theme} /></View>
      <Brand theme={theme} />
      <Text style={[styles.hero, { color: theme.text }]}>Take Control of Your Credit</Text>
      <Text style={[styles.sub, { color: theme.muted }]}>Track cases, upload documents and connect directly with your Savrdh advisor.</Text>
      <Card theme={theme}>
        <Text style={[styles.h2, { color: theme.text }]}>{mode === 'signup' ? 'Create Account' : mode === 'reset' ? 'Reset Password' : 'Welcome back'}</Text>
        <View style={[styles.segment, { backgroundColor: theme.surface2 }]}>
          {(['password', 'otp'] as AuthMode[]).map(item => <Pressable key={item} onPress={() => { setMode(item); setOtpSent(false); setOtp(''); setResetVerified(false); }} style={[styles.segmentItem, mode === item && { backgroundColor: theme.primary }]}><Text style={{ color: mode === item ? (theme.dark ? '#071426' : '#fff') : theme.muted, fontWeight: '800' }}>{item === 'password' ? 'Password' : 'OTP Login'}</Text></Pressable>)}
        </View>
        {mode === 'signup' && <><Field label="Full Name" value={name} onChangeText={setName} theme={theme} /><Field label="Mobile Number" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" theme={theme} /></>}
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" theme={theme} />
        {(mode === 'otp' || mode === 'reset') && otpSent && !resetVerified && <Field label="6-digit OTP" value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} theme={theme} />}
        {(mode === 'password' || mode === 'signup' || (mode === 'reset' && resetVerified)) && <Field label={mode === 'reset' ? 'New Password' : 'Password'} value={password} onChangeText={setPassword} secureTextEntry theme={theme} />}
        <Button label={busy ? 'Please wait…' : mode === 'signup' ? 'Create Account' : mode === 'otp' ? (otpSent ? 'Verify & Sign In' : 'Send OTP') : mode === 'reset' ? (!otpSent ? 'Send Reset OTP' : !resetVerified ? 'Verify OTP' : 'Set New Password') : 'Sign In'} onPress={submit} theme={theme} disabled={busy} />
        {mode === 'password' && <Pressable onPress={() => { setMode('reset'); setOtpSent(false); setOtp(''); setResetVerified(false); }}><Text style={[styles.link, { color: theme.primary }]}>Forgot password?</Text></Pressable>}
        <Pressable onPress={() => setMode(mode === 'signup' ? 'password' : 'signup')}><Text style={[styles.link, { color: theme.primary }]}>{mode === 'signup' ? 'Already registered? Sign in' : 'New to SAVRDH? Create an account'}</Text></Pressable>
      </Card>
      <Pressable onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_WEBSITE_URL || 'https://savrdhfinancialservices.com')}><Text style={[styles.link, { color: theme.muted }]}>Visit savrdhfinancialservices.com</Text></Pressable>
    </ScrollView>
  </KeyboardAvoidingView>;
}

function CustomerApp({ session, theme, dark, setDark }: { session: Session; theme: AppTheme; dark: boolean; setDark: (v: boolean) => void }) {
  const [tab, setTab] = useState<Tab>('home');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [report, setReport] = useState<CreditReport | null>(null);
  const [requests, setRequests] = useState<ResolutionRequest[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const uid = session.user.id;
    const metadata = session.user.user_metadata || {};
    await supabase.from('scr01_profiles').upsert({
      user_id: uid,
      full_name: metadata.full_name || session.user.email?.split('@')[0] || 'Savrdh Customer',
      mobile: metadata.mobile || null,
    }, { onConflict: 'user_id', ignoreDuplicates: true });
    const [p, c, r, pay] = await Promise.all([
      supabase.from('scr01_profiles').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('scr01_credit_reports').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('scr01_requests').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      supabase.from('website_payments').select('*').eq('customer_id', `APP-${uid}`).order('created_at', { ascending: false }),
    ]);
    if (p.data) setProfile(p.data as Profile);
    if (c.data) setReport(c.data as CreditReport);
    setRequests((r.data || []) as ResolutionRequest[]);
    setPayments((pay.data || []) as Payment[]);
    setBusy(false); setRefreshing(false);
  }

  useEffect(() => {
    load();
    const channel = supabase.channel(`mobile-${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scr01_requests', filter: `user_id=eq.${session.user.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'website_notifications', filter: `user_id=eq.${session.user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session.user.id]);

  const content = busy ? <View style={styles.center}><ActivityIndicator color={theme.primary} /></View> :
    tab === 'home' ? <Home theme={theme} profile={profile} report={report} requests={requests} go={setTab} /> :
    tab === 'report' ? <Report theme={theme} report={report} /> :
    tab === 'new' ? <NewRequest theme={theme} userId={session.user.id} onCreated={() => { load(); setTab('requests'); }} /> :
    tab === 'requests' ? <Requests theme={theme} requests={requests} userId={session.user.id} /> :
    <ProfileScreen theme={theme} dark={dark} setDark={setDark} email={session.user.email || ''} profile={profile} payments={payments} />;

  return <View style={{ flex: 1, backgroundColor: theme.bg }}>
    <View style={[styles.appHeader, { borderBottomColor: theme.border }]}><Brand theme={theme} compact /><Text style={[styles.sync, { color: theme.success }]}>● CRM Sync: Live</Text></View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.screen} refreshControl={<RefreshControl refreshing={refreshing} tintColor={theme.primary} onRefresh={() => { setRefreshing(true); load(); }} />} keyboardShouldPersistTaps="handled">{content}</ScrollView>
    <Nav tab={tab} setTab={setTab} theme={theme} />
  </View>;
}

function Home({ theme, profile, report, requests, go }: { theme: AppTheme; profile: Profile | null; report: CreditReport | null; requests: ResolutionRequest[]; go: (t: Tab) => void }) {
  const active = requests.filter(r => !['resolved', 'rejected'].includes(r.status));
  return <>
    <Text style={[styles.eyebrow, { color: theme.gold }]}>HELLO, {(profile?.full_name || 'CUSTOMER').toUpperCase()} 👋</Text>
    <ScoreCard theme={theme} report={report} />
    <Text style={[styles.h2, { color: theme.text }]}>Quick Actions</Text>
    <View style={styles.grid}>
      <Action icon="▤" label="Credit Report" onPress={() => go('report')} theme={theme} />
      <Action icon="◔" label="Score Simulator" onPress={() => Alert.alert('Score Simulator', 'Your advisor will update improvement scenarios after report review.')} theme={theme} />
      <Action icon="＋" label="Raise Request" onPress={() => go('new')} theme={theme} />
      <Action icon="☰" label="My Requests" onPress={() => go('requests')} theme={theme} />
    </View>
    <Card theme={theme}><Text style={[styles.label, { color: theme.muted }]}>Assigned Advisor</Text><Text style={[styles.h3, { color: theme.text }]}>{profile?.assigned_advisor || 'Savrdh Resolution Desk'}</Text><Text style={{ color: theme.success, marginTop: 5 }}>Online • CRM connected</Text></Card>
    <Text style={[styles.h2, { color: theme.text }]}>Current Case Progress</Text>
    {active.length ? active.slice(0, 2).map(r => <RequestCard key={r.id} item={r} theme={theme} />) : <Empty text="No active request. Tap + to raise one." theme={theme} />}
  </>;
}

function Report({ theme, report }: { theme: AppTheme; report: CreditReport | null }) {
  if (!report) return <Empty text="Your verified credit report will appear here after CRM review." theme={theme} />;
  return <><Text style={[styles.h1, { color: theme.text }]}>Credit Report</Text><ScoreCard theme={theme} report={report} />
    <View style={styles.grid}><Metric label="Total Accounts" value={report.total_accounts} theme={theme} /><Metric label="Open Accounts" value={report.open_accounts} theme={theme} /><Metric label="Closed Accounts" value={report.closed_accounts} theme={theme} /><Metric label="Enquiries" value={report.enquiries} theme={theme} /></View>
    <Card theme={theme}><Text style={[styles.h3, { color: theme.text }]}>Account Status</Text><Progress value={Number(report.utilization_percent)} theme={theme} /><Text style={{ color: theme.muted }}>{report.utilization_percent}% credit utilization</Text></Card>
    <Text style={[styles.h2, { color: theme.text }]}>Top Factors Affecting Score</Text>
    {(report.factors || []).map((f, i) => <View key={`${f.label}-${i}`} style={[styles.row, { borderBottomColor: theme.border }]}><Text style={{ color: theme.text, flex: 1 }}>{f.label}</Text><Text style={{ color: f.impact === 'high' ? theme.danger : f.impact === 'medium' ? theme.warning : theme.success }}>{f.impact.toUpperCase()}</Text></View>)}
  </>;
}

function NewRequest({ theme, userId, onCreated }: { theme: AppTheme; userId: string; onCreated: () => void }) {
  const [issue, setIssue] = useState('Incorrect Payment Status');
  const [lender, setLender] = useState('');
  const [last4, setLast4] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true });
    if (!result.canceled) setFile(result.assets[0] || null);
  }
  async function submit() {
    if (!issue || description.trim().length < 10) return Alert.alert('More details required', 'Please explain the issue in at least 10 characters.');
    setBusy(true);
    try {
      const { data: request, error } = await supabase.from('scr01_requests').insert({ user_id: userId, issue_type: issue, lender_name: lender || null, account_last4: last4 || null, description, status: 'submitted' }).select().single();
      if (error) throw error;
      if (file) {
        const path = `${userId}/${request.id}/${Date.now()}-${safeName(file.name)}`;
        const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
        const upload = await supabase.storage.from('scr01-documents').upload(path, decode(base64), { contentType: file.mimeType || 'application/octet-stream', upsert: false });
        if (upload.error) throw upload.error;
        const saved = await supabase.from('scr01_documents').insert({ user_id: userId, request_id: request.id, name: file.name, storage_path: path, mime_type: file.mimeType, size_bytes: file.size || null });
        if (saved.error) throw saved.error;
      }
      Alert.alert('Request Submitted', `Ticket ${request.request_number} is now synced with CRM.`); onCreated();
    } catch (e) { Alert.alert('Request not submitted', messageOf(e)); }
    finally { setBusy(false); }
  }
  return <><Text style={[styles.h1, { color: theme.text }]}>Raise Request</Text><Text style={[styles.subLeft, { color: theme.muted }]}>Tell us about your credit-report issue.</Text>
    <Field label="Issue Type" value={issue} onChangeText={setIssue} theme={theme} />
    <Field label="Lender / Bank" value={lender} onChangeText={setLender} theme={theme} />
    <Field label="Account Last 4 Digits" value={last4} onChangeText={setLast4} keyboardType="number-pad" maxLength={4} theme={theme} />
    <Field label="Explain the Issue" value={description} onChangeText={setDescription} multiline theme={theme} />
    <Pressable onPress={pick} style={[styles.upload, { borderColor: theme.primary, backgroundColor: theme.surface }]}><Text style={{ color: theme.primary, fontWeight: '800' }}>{file ? `✓ ${file.name}` : '＋ Upload Supporting Document'}</Text><Text style={{ color: theme.muted, marginTop: 5 }}>PDF, JPG or PNG • Max 10 MB</Text></Pressable>
    <Button label={busy ? 'Submitting…' : 'Submit Request →'} onPress={submit} theme={theme} disabled={busy} />
  </>;
}

function Requests({ theme, requests, userId }: { theme: AppTheme; requests: ResolutionRequest[]; userId: string }) {
  const [selected, setSelected] = useState<ResolutionRequest | null>(null);
  if (selected) return <><Pressable onPress={() => setSelected(null)}><Text style={{ color: theme.primary, fontWeight: '800' }}>‹ Back to requests</Text></Pressable><RequestCard item={selected} theme={theme} detailed /><Chat theme={theme} userId={userId} caseId={selected.request_number} /></>;
  return <><Text style={[styles.h1, { color: theme.text }]}>My Requests</Text>{requests.length ? requests.map(r => <Pressable key={r.id} onPress={() => setSelected(r)}><RequestCard item={r} theme={theme} /></Pressable>) : <Empty text="No requests yet." theme={theme} />}</>;
}

function Chat({ theme, userId, caseId }: { theme: AppTheme; userId: string; caseId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  async function load() { const { data } = await supabase.from('website_messages').select('*').eq('user_id', userId).eq('case_id', caseId).order('created_at'); setMessages((data || []) as Message[]); }
  useEffect(() => { load(); const c = supabase.channel(`chat-${caseId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'website_messages', filter: `user_id=eq.${userId}` }, load).subscribe(); return () => { supabase.removeChannel(c); }; }, [caseId, userId]);
  async function send() { if (!text.trim()) return; const body = text.trim(); setText(''); const { error } = await supabase.from('website_messages').insert({ user_id: userId, case_id: caseId, sender_id: userId, receiver_id: 'CRM', message: body, raw_data: { source: 'CUSTOMER_APP' } }); if (error) Alert.alert('Message not sent', error.message); }
  return <Card theme={theme}><Text style={[styles.h3, { color: theme.text }]}>CRM Support</Text><Text style={{ color: theme.success, marginBottom: 12 }}>● Advisor chat • Live</Text>{messages.map(m => <View key={m.id} style={[styles.bubble, { alignSelf: m.sender_id === userId ? 'flex-end' : 'flex-start', backgroundColor: m.sender_id === userId ? theme.primary : theme.surface2 }]}><Text style={{ color: m.sender_id === userId && !theme.dark ? '#fff' : theme.text }}>{m.message}</Text></View>)}<View style={styles.chatRow}><TextInput value={text} onChangeText={setText} placeholder="Type your message…" placeholderTextColor={theme.muted} style={[styles.chatInput, { color: theme.text, borderColor: theme.border }]} /><Pressable onPress={send} style={[styles.send, { backgroundColor: theme.primary }]}><Text style={{ fontWeight: '900', color: theme.dark ? '#071426' : '#fff' }}>➤</Text></Pressable></View></Card>;
}

function ProfileScreen({ theme, dark, setDark, email, profile, payments }: { theme: AppTheme; dark: boolean; setDark: (v: boolean) => void; email: string; profile: Profile | null; payments: Payment[] }) {
  return <><Text style={[styles.h1, { color: theme.text }]}>Profile</Text><Card theme={theme}><Text style={[styles.h2, { color: theme.text }]}>{profile?.full_name || 'Savrdh Customer'}</Text><Text style={{ color: theme.muted }}>{email}</Text><Text style={{ color: theme.muted }}>{profile?.mobile || ''}</Text><Text style={{ color: profile?.kyc_status === 'verified' ? theme.success : theme.warning, marginTop: 10 }}>KYC: {(profile?.kyc_status || 'pending').toUpperCase()}</Text></Card>
    <Card theme={theme}><Text style={[styles.h3, { color: theme.text }]}>Appearance</Text><ThemeToggle dark={dark} setDark={setDark} theme={theme} /></Card>
    <Text style={[styles.h2, { color: theme.text }]}>Payments & Receipts</Text>{payments.length ? payments.map(p => <Card theme={theme} key={p.id}><View style={styles.between}><View><Text style={[styles.h3, { color: theme.text }]}>₹{Number(p.amount).toLocaleString('en-IN')}</Text><Text style={{ color: theme.muted }}>{p.payment_type || 'Payment'} • {p.status || 'pending'}</Text></View><Text style={{ color: theme.primary }}>Receipt</Text></View></Card>) : <Empty text="No payment history." theme={theme} />}
    <Button label="Open Web Client Portal" theme={theme} onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_PORTAL_URL || 'https://savrdhfinancialservices.com/portal/login')} />
    <Pressable onPress={() => supabase.auth.signOut()}><Text style={[styles.link, { color: theme.danger }]}>Sign Out</Text></Pressable>
  </>;
}

function ScoreCard({ theme, report }: { theme: AppTheme; report: CreditReport | null }) {
  const score = report?.score || 0;
  return <Card theme={theme}><View style={styles.between}><View><Text style={[styles.label, { color: theme.muted }]}>Your CIBIL Score</Text><Text style={[styles.score, { color: theme.text }]}>{score || '—'}</Text><Text style={{ color: score >= 750 ? theme.success : score ? theme.warning : theme.muted }}>{score ? (score >= 750 ? 'Excellent' : score >= 650 ? 'Good' : 'Needs attention') : 'Awaiting verified report'}</Text></View><View style={[styles.scoreRing, { borderColor: score >= 750 ? theme.success : theme.primary }]}><Text style={{ color: theme.text, fontWeight: '900' }}>300—900</Text></View></View></Card>;
}

function RequestCard({ item, theme, detailed }: { item: ResolutionRequest; theme: AppTheme; detailed?: boolean }) {
  const pct = statusProgress(item.status);
  return <Card theme={theme}><View style={styles.between}><Text style={[styles.badge, { color: theme.gold, borderColor: theme.gold }]}>{item.priority.toUpperCase()}</Text><Text style={{ color: statusColor(item.status, theme), fontWeight: '800' }}>{humanStatus(item.status)}</Text></View><Text style={[styles.h3, { color: theme.text }]}>{item.issue_type}</Text><Text style={{ color: theme.muted }}>{item.request_number}{item.lender_name ? ` • ${item.lender_name}` : ''}</Text><Progress value={pct} theme={theme} />{detailed && <><Text style={{ color: theme.text, marginTop: 8 }}>{item.description}</Text><Text style={{ color: theme.muted, marginTop: 10 }}>Assigned advisor: {item.assigned_advisor || 'Savrdh Resolution Desk'}</Text></>}</Card>;
}

function Nav({ tab, setTab, theme }: { tab: Tab; setTab: (t: Tab) => void; theme: AppTheme }) {
  const items: Array<[Tab, string, string]> = [['home', '⌂', 'Home'], ['report', '▤', 'Report'], ['new', '+', 'New'], ['requests', '☰', 'Requests'], ['profile', '○', 'Profile']];
  return <View style={[styles.nav, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>{items.map(([id, icon, label]) => <Pressable key={id} onPress={() => setTab(id)} style={[styles.navItem, id === 'new' && { backgroundColor: theme.primary, borderRadius: 28, marginTop: -22 }]}><Text style={{ color: tab === id || id === 'new' ? (id === 'new' && !theme.dark ? '#fff' : theme.primary) : theme.muted, fontSize: id === 'new' ? 28 : 20 }}>{icon}</Text><Text style={{ color: tab === id ? theme.primary : theme.muted, fontSize: 10, fontWeight: '700' }}>{label}</Text></Pressable>)}</View>;
}

function Brand({ theme, compact }: { theme: AppTheme; compact?: boolean }) { return <View style={[styles.brand, compact && { flexDirection: 'row', gap: 8, marginVertical: 0 }]}><View style={[styles.logo, { borderColor: theme.gold }]}><Text style={{ color: theme.gold, fontSize: compact ? 16 : 26, fontWeight: '900' }}>S</Text></View><View><Text style={[compact ? styles.brandCompact : styles.brandName, { color: theme.text }]}>SAVRDH</Text><Text style={[styles.brandSub, { color: theme.gold }]}>CREDIT RESOLUTION</Text></View></View>; }
function Card({ theme, children }: { theme: AppTheme; children: React.ReactNode }) { return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>{children}</View>; }
function Button({ label, onPress, theme, disabled }: { label: string; onPress: () => void; theme: AppTheme; disabled?: boolean }) { return <Pressable disabled={disabled} onPress={onPress} style={[styles.button, { backgroundColor: theme.primary, opacity: disabled ? .55 : 1 }]}><Text style={{ color: theme.dark ? '#071426' : '#fff', fontWeight: '900', fontSize: 16 }}>{label}</Text></Pressable>; }
function Field({ label, theme, ...props }: { label: string; theme: AppTheme } & React.ComponentProps<typeof TextInput>) { return <View style={{ marginTop: 14 }}><Text style={[styles.fieldLabel, { color: theme.muted }]}>{label.toUpperCase()}</Text><TextInput {...props} placeholderTextColor={theme.muted} style={[styles.input, props.multiline && { minHeight: 100, textAlignVertical: 'top' }, { color: theme.text, backgroundColor: theme.surface2, borderColor: theme.border }]} /></View>; }
function ThemeToggle({ dark, setDark, theme }: { dark: boolean; setDark: (v: boolean) => void; theme: AppTheme }) { return <Pressable onPress={() => setDark(!dark)} style={[styles.themeToggle, { borderColor: theme.border, backgroundColor: theme.surface2 }]}><Text style={{ color: theme.text }}>{dark ? '☾ Dark Mode' : '☀ Light Mode'}</Text></Pressable>; }
function Action({ icon, label, onPress, theme }: { icon: string; label: string; onPress: () => void; theme: AppTheme }) { return <Pressable onPress={onPress} style={[styles.action, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={{ color: theme.primary, fontSize: 25 }}>{icon}</Text><Text style={{ color: theme.text, fontWeight: '700', marginTop: 7, textAlign: 'center' }}>{label}</Text></Pressable>; }
function Metric({ label, value, theme }: { label: string; value: number; theme: AppTheme }) { return <View style={[styles.metric, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={{ color: theme.muted }}>{label}</Text><Text style={[styles.h2, { color: theme.text }]}>{String(value).padStart(2, '0')}</Text></View>; }
function Progress({ value, theme }: { value: number; theme: AppTheme }) { return <View style={[styles.progressTrack, { backgroundColor: theme.surface2 }]}><View style={[styles.progressFill, { backgroundColor: theme.success, width: `${Math.max(3, Math.min(100, value))}%` }]} /></View>; }
function Empty({ text, theme }: { text: string; theme: AppTheme }) { return <View style={[styles.empty, { borderColor: theme.border }]}><Text style={{ color: theme.muted, textAlign: 'center' }}>{text}</Text></View>; }

function messageOf(error: unknown) { return error instanceof Error ? error.message : 'Please try again.'; }
function safeName(name: string) { return name.replace(/[^a-zA-Z0-9._-]/g, '-'); }
function humanStatus(s: string) { return s.split('_').map(x => x[0]?.toUpperCase() + x.slice(1)).join(' '); }
function statusProgress(s: string) { return ({ draft: 10, submitted: 25, under_review: 45, disputed: 70, resolved: 100, rejected: 100 } as Record<string, number>)[s] || 20; }
function statusColor(s: string, t: AppTheme) { return s === 'resolved' ? t.success : s === 'rejected' ? t.danger : t.primary; }

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 }, authWrap: { flexGrow: 1, padding: 22, justifyContent: 'center' }, topActions: { alignItems: 'flex-end' }, brand: { alignItems: 'center', justifyContent: 'center', marginVertical: 22 }, logo: { width: 48, height: 48, borderWidth: 2, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, brandName: { fontSize: 32, letterSpacing: 5, fontWeight: '500' }, brandCompact: { fontSize: 17, letterSpacing: 2, fontWeight: '900' }, brandSub: { letterSpacing: 2.2, fontSize: 10, fontWeight: '800' }, hero: { fontSize: 30, fontWeight: '900', textAlign: 'center' }, sub: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginVertical: 12 }, subLeft: { fontSize: 15, marginBottom: 8 }, card: { padding: 17, borderRadius: 18, borderWidth: 1, marginVertical: 9 }, h1: { fontSize: 28, fontWeight: '900', marginBottom: 8 }, h2: { fontSize: 20, fontWeight: '900', marginVertical: 8 }, h3: { fontSize: 16, fontWeight: '900', marginTop: 8 }, eyebrow: { letterSpacing: 1.5, fontWeight: '900', marginBottom: 5 }, label: { fontSize: 13, fontWeight: '700' }, segment: { flexDirection: 'row', borderRadius: 24, padding: 4, marginVertical: 14 }, segmentItem: { flex: 1, padding: 12, borderRadius: 20, alignItems: 'center' }, fieldLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 }, input: { padding: 14, borderRadius: 11, borderWidth: 1, fontSize: 15 }, button: { padding: 16, borderRadius: 13, alignItems: 'center', marginTop: 18 }, link: { textAlign: 'center', marginTop: 18, fontWeight: '800' }, appHeader: { paddingTop: 50, paddingHorizontal: 18, paddingBottom: 10, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sync: { fontSize: 11, fontWeight: '800' }, screen: { padding: 16, paddingBottom: 30 }, grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 }, action: { width: '47.5%', margin: '1.25%', borderWidth: 1, borderRadius: 16, minHeight: 105, alignItems: 'center', justifyContent: 'center', padding: 12 }, metric: { width: '47.5%', margin: '1.25%', borderWidth: 1, borderRadius: 14, padding: 14 }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, score: { fontSize: 48, lineHeight: 54, fontWeight: '900' }, scoreRing: { width: 92, height: 92, borderRadius: 50, borderWidth: 10, alignItems: 'center', justifyContent: 'center' }, progressTrack: { height: 8, borderRadius: 6, marginVertical: 14, overflow: 'hidden' }, progressFill: { height: 8, borderRadius: 6 }, row: { flexDirection: 'row', paddingVertical: 15, borderBottomWidth: 1 }, badge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, fontSize: 10, fontWeight: '900' }, upload: { marginVertical: 18, minHeight: 100, borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 15 }, bubble: { maxWidth: '84%', borderRadius: 15, padding: 11, marginVertical: 4 }, chatRow: { flexDirection: 'row', gap: 8, marginTop: 15 }, chatInput: { flex: 1, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14 }, send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, nav: { height: 78, borderTopWidth: 1, flexDirection: 'row', paddingBottom: 10 }, navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }, themeToggle: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 20, borderWidth: 1 }, empty: { padding: 30, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', marginVertical: 10 },
});
