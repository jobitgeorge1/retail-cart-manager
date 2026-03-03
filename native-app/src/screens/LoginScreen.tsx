import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

export function LoginScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Sign in to access your synced carts and prices.');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  async function onSubmit() {
    setStatus('');

    if (mode === 'signin') {
      if (!identifier.trim() || !password.trim()) {
        setStatus('Enter email/username and password.');
        return;
      }
      try {
        setLoading(true);
        await login(identifier.trim(), password);
      } catch (error: any) {
        setStatus(`Sign in failed. ${error?.message || ''}`.trim());
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!name.trim() || !email.trim() || !username.trim() || !signupPassword || !confirmPassword) {
      setStatus('Fill all sign up fields.');
      return;
    }

    if (signupPassword !== confirmPassword) {
      setStatus('Password and confirm password do not match.');
      return;
    }

    try {
      setLoading(true);
      await register(name.trim(), email.trim().toLowerCase(), username.trim(), signupPassword);
    } catch (error: any) {
      setStatus(`Sign up failed. ${error?.message || ''}`.trim());
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Personal Cart Manager</Text>
          <Text style={styles.subtitle}>Native app with cloud sync via Appwrite</Text>

          <View style={styles.modeRow}>
            <Pressable
              onPress={() => {
                setMode('signin');
                setStatus('Sign in to access your synced carts and prices.');
              }}
              style={[styles.modeBtn, mode === 'signin' && styles.modeBtnActive]}
            >
              <Text style={[styles.modeText, mode === 'signin' && styles.modeTextActive]}>Sign In</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMode('signup');
                setStatus('Create a new account.');
              }}
              style={[styles.modeBtn, mode === 'signup' && styles.modeBtnActive]}
            >
              <Text style={[styles.modeText, mode === 'signup' && styles.modeTextActive]}>Sign Up</Text>
            </Pressable>
          </View>

          {mode === 'signin' ? (
            <>
              <TextInput
                placeholder="Email or Username"
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                style={styles.input}
              />
              <TextInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.input}
              />
            </>
          ) : (
            <>
              <TextInput placeholder="Full Name" value={name} onChangeText={setName} style={styles.input} />
              <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />
              <TextInput
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                style={styles.input}
              />
              <TextInput
                placeholder="Password"
                value={signupPassword}
                onChangeText={setSignupPassword}
                secureTextEntry
                style={styles.input}
              />
              <TextInput
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                style={styles.input}
              />
            </>
          )}

          <Pressable onPress={onSubmit} disabled={loading} style={[styles.primaryBtn, loading && styles.disabled]}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Continue</Text>}
          </Pressable>

          <Text style={styles.status}>{status}</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b1220' },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#0b1220',
  },
  card: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 14,
    color: '#64748b',
    fontSize: 14,
  },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  modeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  modeBtnActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  modeText: { color: '#0f172a', fontWeight: '700' },
  modeTextActive: { color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#fff',
    marginBottom: 8,
    fontSize: 16,
  },
  primaryBtn: {
    marginTop: 4,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  status: {
    marginTop: 10,
    color: '#475569',
    fontSize: 13,
    minHeight: 20,
  },
  disabled: { opacity: 0.7 },
});
