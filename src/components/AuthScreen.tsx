import React, { useState, useEffect } from 'react';
import { MessageSquare, Lock, Mail, User as UserIcon, ArrowLeft, CheckCircle2, KeyRound, Clock, RefreshCw, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export const AuthScreen: React.FC = () => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [loginEmail, setLoginEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  // Forgot Password / OTP State
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'success'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [timerSeconds, setTimerSeconds] = useState<number>(300); // 5 minutes timer

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP Countdown timer effect
  useEffect(() => {
    let interval: any = null;
    if (mode === 'forgot' && forgotStep === 'otp' && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mode, forgotStep, timerSeconds]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!forgotEmail || !forgotEmail.trim()) {
      setError('Please enter your account email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.sendForgotPasswordOtp(forgotEmail);
      setForgotStep('otp');
      setTimerSeconds(300); // Reset timer to 5 minutes
      setSuccessMsg(res.message || '6-digit OTP code sent to your email.');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordWithOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!otpCode || otpCode.trim().length !== 6) {
      setError('Please enter the full 6-digit OTP code sent to your email.');
      return;
    }

    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify your new password.');
      return;
    }

    if (timerSeconds <= 0) {
      setError('OTP code has expired (5 minute limit). Please click Resend OTP.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.resetPasswordWithOtp(forgotEmail, otpCode.trim(), newPassword);
      setForgotStep('success');
      setSuccessMsg(res.message || 'Password updated successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Incorrect or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!name.trim() || !username.trim() || !email.trim() || !password) {
          throw new Error('Please fill in all fields including your registered email and password.');
        }
        await register(name.trim(), username.trim(), email.trim(), password);
      } else if (mode === 'signin') {
        if (!loginEmail.trim() || !password) {
          throw new Error('Please enter your registered email address and password.');
        }
        await login(loginEmail.trim(), password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl relative overflow-hidden animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 mb-4 ring-2 ring-emerald-500/30">
            <MessageSquare className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Welcome to ChatSphere</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-Time Encrypted Messaging Platform
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded-xl text-xs text-center font-medium flex items-center justify-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && mode !== 'forgot' && (
          <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs text-center font-medium flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {mode === 'forgot' ? (
          <div className="space-y-4 text-xs">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setForgotStep('email');
                setError('');
                setSuccessMsg('');
              }}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-white mb-2 transition font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Sign In
            </button>

            {forgotStep === 'email' && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="bg-slate-700/50 p-3.5 rounded-2xl border border-slate-700 text-slate-300 text-xs">
                  <p className="font-semibold text-white mb-1">🔑 Password Reset Request</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Enter your registered account email. We will send a <strong>6-digit OTP code</strong> to verify your identity (valid for 5 minutes).
                  </p>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-700 text-white rounded-xl border border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    'Sending OTP...'
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" /> Send 6-Digit OTP
                    </>
                  )}
                </button>
              </form>
            )}

            {forgotStep === 'otp' && (
              <form onSubmit={handleResetPasswordWithOtp} className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-2xl text-emerald-300 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-emerald-400" /> OTP Sent to Email
                    </span>
                    <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                      timerSeconds < 60 ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40' : 'bg-slate-800 text-amber-300'
                    }`}>
                      <Clock className="w-3 h-3" /> {formatTimer(timerSeconds)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    We sent a 6-digit OTP to <strong className="text-emerald-200">{forgotEmail}</strong>.
                  </p>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Enter 6-Digit OTP Code</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      maxLength={6}
                      required
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-700 text-emerald-400 font-mono text-center tracking-[8px] text-lg rounded-xl border border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 text-right">Must match the code sent to your inbox</p>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">New Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="password"
                      required
                      placeholder="Enter new password (min 6 chars)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-700 text-white rounded-xl border border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Confirm New Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="password"
                      required
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-700 text-white rounded-xl border border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <button
                    type="submit"
                    disabled={loading || timerSeconds <= 0}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95 disabled:opacity-50"
                  >
                    {loading ? 'Verifying OTP & Updating...' : 'Verify OTP & Change Password'}
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSendOtp()}
                    className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Resend 6-Digit OTP
                  </button>
                </div>
              </form>
            )}

            {forgotStep === 'success' && (
              <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-3 animate-fade-in">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h3 className="font-bold text-white text-base">Password Updated Successfully!</h3>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Your password for <span className="font-semibold text-emerald-300">{forgotEmail}</span> has been securely updated.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail(forgotEmail);
                    setPassword(newPassword);
                    setMode('signin');
                    setForgotStep('email');
                    setError('');
                    setSuccessMsg('Your password has been changed. Click Sign In to log in.');
                  }}
                  className="mt-2 w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg transition"
                >
                  Proceed to Sign In
                </button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {mode === 'signup' ? (
              <>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Alex Rivera"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-700 text-white rounded-xl border border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Username</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="alex_rivera"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-700 text-white rounded-xl border border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="email"
                      placeholder="alex@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-700 text-white rounded-xl border border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="password"
                      placeholder="Enter a strong password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-700 text-white rounded-xl border border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="Enter your registered email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-700 text-white rounded-xl border border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-300 font-semibold">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setForgotStep('email');
                        setError('');
                        setSuccessMsg('');
                      }}
                      className="text-[11px] text-emerald-400 hover:underline font-medium"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="password"
                      required
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-700 text-white rounded-xl border border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95 disabled:opacity-50 mt-2"
            >
              {loading
                ? 'Processing...'
                : mode === 'signup'
                ? 'Sign Up'
                : 'Sign In'}
            </button>
          </form>
        )}

        {mode === 'signin' && (
          <div className="mt-6 pt-5 border-t border-slate-700/70">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
              ⚡ Quick Demo Accounts (1-Click)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setLoginEmail('alex@example.com');
                  setPassword('password123');
                  login('alex@example.com', 'password123');
                }}
                className="p-2 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/70 rounded-xl text-left transition flex items-center gap-2 group text-xs text-white"
              >
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                  alt="Alex"
                  className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-emerald-500/50"
                />
                <div className="truncate">
                  <p className="font-semibold text-xs text-white group-hover:text-emerald-400 truncate">Alex Rivera</p>
                  <p className="text-[10px] text-emerald-400/80 truncate">Admin Account</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLoginEmail('sarah@example.com');
                  setPassword('password123');
                  login('sarah@example.com', 'password123');
                }}
                className="p-2 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/70 rounded-xl text-left transition flex items-center gap-2 group text-xs text-white"
              >
                <img
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80"
                  alt="Sarah"
                  className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-teal-500/50"
                />
                <div className="truncate">
                  <p className="font-semibold text-xs text-white group-hover:text-emerald-400 truncate">Sarah Chen</p>
                  <p className="text-[10px] text-teal-400/80 truncate">Product Lead</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLoginEmail('marcus@example.com');
                  setPassword('password123');
                  login('marcus@example.com', 'password123');
                }}
                className="p-2 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/70 rounded-xl text-left transition flex items-center gap-2 group text-xs text-white"
              >
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
                  alt="Marcus"
                  className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-sky-500/50"
                />
                <div className="truncate">
                  <p className="font-semibold text-xs text-white group-hover:text-emerald-400 truncate">Marcus Vance</p>
                  <p className="text-[10px] text-sky-400/80 truncate">Mobile Dev</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLoginEmail('elena@example.com');
                  setPassword('password123');
                  login('elena@example.com', 'password123');
                }}
                className="p-2 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/70 rounded-xl text-left transition flex items-center gap-2 group text-xs text-white"
              >
                <img
                  src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80"
                  alt="Elena"
                  className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-purple-500/50"
                />
                <div className="truncate">
                  <p className="font-semibold text-xs text-white group-hover:text-emerald-400 truncate">Elena Rostova</p>
                  <p className="text-[10px] text-purple-400/80 truncate">UX Designer</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {mode !== 'forgot' && (
          <div className="mt-5 text-center text-xs">
            <button
              onClick={() => {
                setMode(mode === 'signup' ? 'signin' : 'signup');
                setError('');
                setSuccessMsg('');
              }}
              className="text-emerald-400 hover:underline font-semibold"
            >
              {mode === 'signup'
                ? 'Already have an account? Sign In'
                : "Don't have an account? Sign Up"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
