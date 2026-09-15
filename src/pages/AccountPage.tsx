import { useState, useEffect } from 'react';
import {
  User, Lock, Cpu, Download, Calendar, Crown, Loader2, AlertCircle,
  CheckCircle, Camera, Key, Clock, Shield, ChevronRight, Infinity,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Page } from '@/components/Navbar';

type AccountPageProps = {
  onNavigate: (page: Page) => void;
};

export function AccountPage({ onNavigate }: AccountPageProps) {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [changingPw, setChangingPw] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    const interval = setInterval(() => refreshProfile(), 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshProfile]);

  useEffect(() => {
    setAvatarUrl(profile?.avatar_url ?? null);
  }, [profile?.avatar_url]);

  useEffect(() => {
    if (profile?.subscription_expires_at && profile.subscription_type !== 'lifetime') {
      const expiry = new Date(profile.subscription_expires_at).getTime();
      const now = Date.now();
      const diff = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
      setDaysLeft(diff > 0 ? diff : 0);
    } else if (profile?.subscription_type === 'lifetime') {
      setDaysLeft(null);
    } else {
      setDaysLeft(0);
    }
  }, [profile?.subscription_expires_at, profile?.subscription_type]);

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-24">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Iltimos, avval tizimga kiring.</p>
          <button onClick={() => onNavigate('auth')} className="btn-primary">
            Kirish
          </button>
        </div>
      </div>
    );
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Faylni o\'qib bo\'lmadi'));
        reader.onload = () => {
          const img = new Image();
          img.onerror = () => reject(new Error('Rasmni yuklab bo\'lmadi'));
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 100;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Canvas context yo\'q'));
            const min = Math.min(img.width, img.height);
            const sx = (img.width - min) / 2;
            const sy = (img.height - min) / 2;
            ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
            resolve(canvas.toDataURL('image/jpeg', 0.5));
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      });

      console.log('Base64 length:', base64.length);

      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: base64 })
        .eq('id', user.id)
        .select();

      console.log('Update result:', data, updateError);

      if (updateError) {
        console.error('Supabase update error:', updateError);
        throw updateError;
      }

      setAvatarUrl(base64);
      alert('Avatar yangilandi!');
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      alert('Xatolik: ' + (err.message || err));
    }
    setUploading(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingPw(true);
    setPasswordMsg(null);

    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Yangi parol kamida 6 ta belgidan iborat bo\'lishi kerak.' });
      setChangingPw(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordMsg({ type: 'error', text: error.message });
    } else {
      setPasswordMsg({ type: 'success', text: 'Parol muvaffaqiyatli o\'zgartirildi!' });
      setOldPassword('');
      setNewPassword('');
    }
    setChangingPw(false);
  };

  const hasSubscription = profile.subscription_type !== 'none';
  const isLifetime = profile.subscription_type === 'lifetime';

  const handleDownload = async () => {
    if (!profile) return;
    setDownloading(true);
    try {
      const fileName = `UzumClient-${profile.username}.jar`;
      const response = await fetch(`${import.meta.env.BASE_URL}client.jar`);
      if (!response.ok) throw new Error('Client fayli topilmadi');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      alert('Yuklab olishda xatolik yuz berdi.');
    }
    setDownloading(false);
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-white mb-2">
            Hisobim
          </h1>
          <p className="text-gray-400">Hisobingizni boshqaring va sozlamalarni o'zgartiring.</p>
        </div>

        {/* Blocked banner */}
        {profile.is_blocked && (
          <div className="glass-card p-4 mb-6 border-error-500/30 bg-error-500/5 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-error-400 flex-shrink-0" />
            <p className="text-sm text-error-300">
              Sizning hisobingiz bloklangan. Iltimos, qollab-quvatlash bilan bog'laning.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile card */}
          <div className="lg:col-span-1">
            <div className="glass-card p-6 text-center">
              {/* Avatar */}
              <div className="relative inline-block mb-4">
                <div className="w-28 h-28 rounded-2xl overflow-hidden bg-gradient-to-br from-primary-500/20 to-primary-700/20 border border-primary-500/20 flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-12 h-12 text-primary-400" />
                  )}
                </div>
                <label className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl bg-primary-600 hover:bg-primary-500 cursor-pointer flex items-center justify-center transition-colors shadow-lg">
                  <Camera className="w-4 h-4 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
                {uploading && (
                  <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
                  </div>
                )}
              </div>

              <h2 className="font-display font-bold text-xl text-white mb-1">{profile.username}</h2>
              <p className="text-sm text-gray-400 mb-4">{user.email}</p>

              {/* Admin badge */}
              {profile.is_admin && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning-500/10 border border-warning-500/20 text-xs text-warning-300 font-medium mb-3">
                  <Shield className="w-3.5 h-3.5" />
                  Administrator
                </div>
              )}

              {/* Subscription badge */}
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                hasSubscription
                  ? 'bg-primary-500/10 border border-primary-500/20 text-primary-300'
                  : 'bg-gray-500/10 border border-gray-500/20 text-gray-400'
              }`}>
                <Crown className="w-3.5 h-3.5" />
                {isLifetime ? 'Umrbodlik obuna' : hasSubscription ? 'Faol obuna' : 'Obuna yoq'}
              </div>
            </div>

            {/* Sign out */}
            <button
              onClick={() => { signOut(); onNavigate('home'); }}
              className="w-full mt-4 px-4 py-3 rounded-xl glass-card text-sm font-medium text-error-400 hover:bg-error-500/10 transition-all duration-300 flex items-center justify-center gap-2"
            >
              Tizimdan chiqish
            </button>
          </div>

          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Subscription info */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-lg text-white">Obuna holati</h3>
                  <p className="text-xs text-gray-400">Obunangizning holati va muddati</p>
                </div>
              </div>

              {hasSubscription ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-white/5">
                      <p className="text-xs text-gray-400 mb-1">Obuna turi</p>
                      <p className="font-semibold text-white">
                        {isLifetime ? 'Umrbodlik' : profile.subscription_type === '30day' ? '30 kunlik' : '90 kunlik'}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5">
                      <p className="text-xs text-gray-400 mb-1">Qolgan kunlar</p>
                      <p className="font-semibold text-white flex items-center gap-1.5">
                        {isLifetime ? (
                          <>
                            <Infinity className="w-4 h-4 text-primary-400" />
                            Cheksiz
                          </>
                        ) : (
                          <>
                            <Clock className="w-4 h-4 text-primary-400" />
                            {daysLeft} kun
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {!isLifetime && profile.subscription_expires_at && (
                    <div className="p-4 rounded-xl bg-primary-500/5 border border-primary-500/10">
                      <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                        <Calendar className="w-4 h-4 text-primary-400" />
                        Tugash sanasi
                      </div>
                      <p className="text-sm text-white">
                        {new Date(profile.subscription_expires_at).toLocaleDateString('uz-UZ', {
                          year: 'numeric', month: 'long', day: 'numeric',
                        })}
                      </p>
                      {/* Progress bar */}
                      <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all duration-500"
                          style={{
                            width: isLifetime ? '100%' : `${Math.min((daysLeft ?? 0) / (profile.subscription_type === '30day' ? 30 : 90) * 100, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => onNavigate('subscriptions')}
                    className="btn-secondary w-full text-sm py-3 flex items-center justify-center gap-2"
                  >
                    Obunani uzaytirish
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-gray-400 mb-4">Sizda faol obuna yo'q.</p>
                  <button
                    onClick={() => onNavigate('subscriptions')}
                    className="btn-primary text-sm flex items-center gap-2 mx-auto"
                  >
                    <Crown className="w-4 h-4" />
                    Obuna sotib olish
                  </button>
                </div>
              )}
            </div>

            {/* HWID */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-secondary-500/10 border border-secondary-500/20 flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-secondary-400" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-lg text-white">HWID</h3>
                  <p className="text-xs text-gray-400">Hardware ID - mod bilan bog'liq</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-black/30 border border-white/5">
                <p className="text-xs text-gray-400 mb-2">Sizning HWID raqamingiz:</p>
                <p className="font-mono text-sm text-primary-300 break-all">
                  {profile.hwid || 'HWid hali biriktirilmagan. Modni ishga tushiring.'}
                </p>
              </div>
            </div>

            {/* Mod download */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-accent-500/10 border border-accent-500/20 flex items-center justify-center">
                  <Download className="w-5 h-5 text-accent-400" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-lg text-white">Modni yuklab olish</h3>
                  <p className="text-xs text-gray-400">UZUM CLIENT mod faylini yuklab oling</p>
                </div>
              </div>

              {hasSubscription ? (
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {downloading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                  {downloading ? 'Yuklanmoqda...' : 'Modni yuklab olish'}
                </button>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-400 mb-3">
                    Modni yuklab olish uchun obuna kerak.
                  </p>
                  <button
                    onClick={() => onNavigate('subscriptions')}
                    className="btn-secondary text-sm"
                  >
                    Obuna sotib olish
                  </button>
                </div>
              )}
            </div>

            {/* Change password */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-warning-500/10 border border-warning-500/20 flex items-center justify-center">
                  <Key className="w-5 h-5 text-warning-400" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-lg text-white">Parolni o'zgartirish</h3>
                  <p className="text-xs text-gray-400">Hisobingiz xavfsizligi uchun parolni o'zgartiring</p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Yangi parol</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="glass-input w-full pl-12 pr-4 py-3.5 text-sm"
                      required
                    />
                  </div>
                </div>

                {passwordMsg && (
                  <div className={`flex items-start gap-2 p-3 rounded-xl text-sm ${
                    passwordMsg.type === 'error'
                      ? 'bg-error-500/10 border border-error-500/20 text-error-300'
                      : 'bg-success-500/10 border border-success-500/20 text-success-300'
                  }`}>
                    {passwordMsg.type === 'error' ? (
                      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    )}
                    <span>{passwordMsg.text}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={changingPw}
                  className="btn-secondary w-full flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {changingPw ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Parolni o\'zgartirish'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
