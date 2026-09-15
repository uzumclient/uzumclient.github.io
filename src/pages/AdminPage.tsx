import { useEffect, useState } from 'react';
import {
  Shield, Users, Newspaper, Megaphone, Search, Crown, Cpu,
  Ban, CheckCircle, XCircle, Trash2, Plus, Minus, Loader2, AlertCircle,
  Calendar, Clock, X, Edit3, RefreshCw, CreditCard, ExternalLink, Key, Zap, Star,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type Profile, type NewsItem, type MediaApplication, type PaymentRequest, type PromoCode, type PlanPrice } from '@/lib/supabase';
import type { Page } from '@/components/Navbar';

type AdminPageProps = {
  onNavigate: (page: Page) => void;
};

type Tab = 'users' | 'news' | 'media' | 'payments' | 'promo' | 'prices';

export function AdminPage({ onNavigate }: AdminPageProps) {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<Profile[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [mediaApps, setMediaApps] = useState<MediaApplication[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [promoForm, setPromoForm] = useState({ code: '', discount: '10', maxUses: '' });
  const [prices, setPrices] = useState<PlanPrice[]>([]);
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showNewsModal, setShowNewsModal] = useState(false);
  const [newsForm, setNewsForm] = useState({ title: '', content: '', version: '' });
  const [showSubModal, setShowSubModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.is_admin) return;
    loadAll();
  }, [profile?.is_admin]);

  const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
    Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

  const safeQuery = <T,>(p: Promise<T>, ms = 10000): Promise<PromiseSettledResult<T>> =>
    withTimeout(p, ms).then(
      v => ({ status: 'fulfilled' as const, value: v }),
      e => ({ status: 'rejected' as const, reason: e }),
    );

  const loadAll = async () => {
    setLoading(true);

    const [usersRes, newsRes, mediaRes, promoRes, pricesRes, emailRes] = await Promise.all([
      safeQuery(supabase.from('profiles').select('*').order('created_at', { ascending: false })),
      safeQuery(supabase.from('news').select('*').order('created_at', { ascending: false })),
      safeQuery(supabase.from('media_applications').select('*').order('created_at', { ascending: false })),
      safeQuery(supabase.from('promo_codes').select('*').order('created_at', { ascending: false })),
      safeQuery(supabase.from('plan_prices').select('*').order('id', { ascending: true })),
      safeQuery(supabase.rpc('get_all_emails')),
    ]);

    const profiles = usersRes.status === 'fulfilled' ? (usersRes.value.data as Profile[] | null) : null;

    if (profiles) {
      const emailData = emailRes.status === 'fulfilled' ? emailRes.value.data : null;
      const emailMap = new Map<string, string>();
      if (Array.isArray(emailData)) {
        for (const e of emailData) {
          if (e.user_id && e.email) emailMap.set(e.user_id, e.email);
        }
      }
      setUsers(profiles.map(u => ({ ...u, email: emailMap.get(u.id) || u.email })));
    }

    if (newsRes.status === 'fulfilled' && newsRes.value.data) setNews(newsRes.value.data as NewsItem[]);

    if (mediaRes.status === 'fulfilled' && mediaRes.value.data) {
      const all = mediaRes.value.data as MediaApplication[];
      const paymentPlanIds = ['30day', '90day', 'lifetime', 'hwid_reset'];
      setMediaApps(all.filter(a => !paymentPlanIds.includes(a.channel_url)));
      setPaymentRequests(all.filter(a => paymentPlanIds.includes(a.channel_url)) as PaymentRequest[]);
    }

    if (promoRes.status === 'fulfilled' && promoRes.value.data) setPromos(promoRes.value.data as PromoCode[]);

    if (pricesRes.status === 'fulfilled' && pricesRes.value.data) {
      const list = pricesRes.value.data as PlanPrice[];
      setPrices(list);
      const m: Record<string, string> = {};
      for (const p of list) m[p.id] = String(p.price);
      setPriceEdits(m);
    }

    setLoading(false);
  };

  if (!profile?.is_admin) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-24">
        <div className="text-center">
          <Shield className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">Sizda admin huquqlari yo'q.</p>
          <button onClick={() => onNavigate('home')} className="btn-primary">Bosh sahifa</button>
        </div>
      </div>
    );
  }

  const assignSubscription = async (userId: string, type: 'none' | '30day' | '90day' | 'lifetime') => {
    setActionLoading(userId);
    let expiresAt: string | null = null;
    if (type === '30day') {
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    } else if (type === '90day') {
      expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    }

    const { data: _upd, error } = await supabase
      .from('profiles')
      .update({ subscription_type: type, subscription_expires_at: expiresAt })
      .eq('id', userId)
      .select('id');

    if (!error && _upd && _upd.length > 0) {
      setUsers(users.map(u => u.id === userId ? { ...u, subscription_type: type, subscription_expires_at: expiresAt } : u));
    } else {
      alert('Xatolik: obuna berilmadi. ' + (error?.message || 'Qator yangilanmadi (RLS tekshiring).'));
    }
    setActionLoading(null);
  };

  const resetHwid = async (userId: string) => {
    setActionLoading(userId);
    const { data: _upd, error } = await supabase.from('profiles').update({ hwid: null }).eq('id', userId).select('id');
    if (!error && _upd && _upd.length > 0) {
      setUsers(users.map(u => u.id === userId ? { ...u, hwid: null } : u));
    } else {
      alert('Xatolik: HWID tozalanmadi. ' + (error?.message || ''));
    }
    setActionLoading(null);
  };

  const toggleBlock = async (userId: string, currentBlocked: boolean) => {
    setActionLoading(userId);
    const { data: _upd, error } = await supabase.from('profiles').update({ is_blocked: !currentBlocked }).eq('id', userId).select('id');
    if (!error && _upd && _upd.length > 0) {
      setUsers(users.map(u => u.id === userId ? { ...u, is_blocked: !currentBlocked } : u));
    } else {
      alert('Xatolik: blok holati o\'zgarmadi. ' + (error?.message || ''));
    }
    setActionLoading(null);
  };

  const removeSubscription = async (userId: string) => {
    setActionLoading(userId);
    const { data: _upd, error } = await supabase
      .from('profiles')
      .update({ subscription_type: 'none', subscription_expires_at: null })
      .eq('id', userId)
      .select('id');
    if (!error && _upd && _upd.length > 0) {
      setUsers(users.map(u => u.id === userId ? { ...u, subscription_type: 'none', subscription_expires_at: null } : u));
    } else {
      alert('Xatolik: obuna olib tashlanmadi. ' + (error?.message || ''));
    }
    setActionLoading(null);
  };

  const createPromo = async () => {
    const code = promoForm.code.trim().toUpperCase();
    const discount = parseInt(promoForm.discount) || 0;
    if (!code || discount < 1 || discount > 90) {
      alert('Kod va 1-90 oralig\'ida chegirma kiriting.');
      return;
    }
    setActionLoading('promo');
    const maxUses = promoForm.maxUses.trim() ? parseInt(promoForm.maxUses) : null;
    const { data, error } = await supabase
      .from('promo_codes')
      .insert({ code, discount_percent: discount, max_uses: maxUses })
      .select()
      .single();
    if (!error && data) {
      setPromos([data as PromoCode, ...promos]);
      setPromoForm({ code: '', discount: '10', maxUses: '' });
    } else {
      alert('Xatolik: promokod yaratilmadi. ' + (error?.message || ''));
    }
    setActionLoading(null);
  };

  const togglePromo = async (p: PromoCode) => {
    setActionLoading(p.id);
    const { error } = await supabase.from('promo_codes').update({ is_active: !p.is_active }).eq('id', p.id);
    if (!error) {
      setPromos(promos.map(x => x.id === p.id ? { ...x, is_active: !p.is_active } : x));
    } else {
      alert('Xatolik: ' + error.message);
    }
    setActionLoading(null);
  };

  const deletePromo = async (id: string) => {
    setActionLoading(id);
    const { error } = await supabase.from('promo_codes').delete().eq('id', id);
    if (!error) {
      setPromos(promos.filter(x => x.id !== id));
    } else {
      alert('Xatolik: ' + error.message);
    }
    setActionLoading(null);
  };

  const savePrices = async () => {
    setActionLoading('prices');
    for (const p of prices) {
      const raw = priceEdits[p.id];
      const n = parseInt(String(raw).replace(/\D/g, ''), 10);
      if (!Number.isFinite(n) || n < 0) continue;
      if (n === p.price) continue;
      const { error } = await supabase.from('plan_prices').update({ price: n }).eq('id', p.id);
      if (error) {
        alert(`Narx saqlanmadi (${p.id}): ` + error.message);
        setActionLoading(null);
        return;
      }
    }
    const fresh = await supabase.from('plan_prices').select('*').order('id', { ascending: true });
    if (fresh.data) {
      const list = fresh.data as PlanPrice[];
      setPrices(list);
      const m: Record<string, string> = {};
      for (const p of list) m[p.id] = String(p.price);
      setPriceEdits(m);
    }
    setActionLoading(null);
  };

  const openSubModal = (userId: string) => {
    setSelectedUserId(userId);
    setShowSubModal(true);
  };

  const assignFromModal = async (type: Profile['subscription_type']) => {
    if (!selectedUserId) return;
    await assignSubscription(selectedUserId, type);
    setShowSubModal(false);
    setSelectedUserId(null);
  };

  const createNews = async () => {
    if (!newsForm.title.trim() || !newsForm.content.trim()) return;
    setActionLoading('news');
    const { data, error } = await supabase
      .from('news')
      .insert({ title: newsForm.title, content: newsForm.content, version: newsForm.version || null })
      .select()
      .single();
    if (!error && data) {
      setNews([data as NewsItem, ...news]);
      setNewsForm({ title: '', content: '', version: '' });
      setShowNewsModal(false);
    }
    setActionLoading(null);
  };

  const deleteNews = async (id: string) => {
    const { error } = await supabase.from('news').delete().eq('id', id);
    if (!error) setNews(news.filter(n => n.id !== id));
  };

  const reviewMediaApp = async (id: string, status: 'approved' | 'rejected') => {
    setActionLoading(id);
    const { error } = await supabase
      .from('media_applications')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) {
      setMediaApps(mediaApps.map(a => a.id === id ? { ...a, status, reviewed_at: new Date().toISOString() } : a));
    }
    setActionLoading(null);
  };

  const reviewPayment = async (id: string, status: 'approved' | 'rejected') => {
    setActionLoading(id);

    if (status === 'approved') {
      const req = paymentRequests.find(p => p.id === id);
      if (req) {
        if (req.channel_url === 'hwid_reset') {
          const { data: _upd, error: hwidErr } = await supabase.from('profiles').update({ hwid: null }).eq('id', req.user_id).select('id');
          if (hwidErr || !_upd || _upd.length === 0) {
            alert('Xatolik: HWID tozalanmadi. ' + (hwidErr?.message || 'Qator yangilanmadi.'));
            setActionLoading(null);
            return;
          }
        } else {
          let expiresAt: string | null = null;
          if (req.channel_url === '30day') {
            expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          } else if (req.channel_url === '90day') {
            expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
          }

          const { data: _upd, error: subError } = await supabase
            .from('profiles')
            .update({ subscription_type: req.channel_url as Profile['subscription_type'], subscription_expires_at: expiresAt })
            .eq('id', req.user_id)
            .select('id');
          if (subError || !_upd || _upd.length === 0) {
            alert('Xatolik: obuna berilmadi. ' + (subError?.message || 'Qator yangilanmadi (RLS tekshiring).'));
            setActionLoading(null);
            return;
          }
        }

        if ((req as MediaApplication).promo_code) {
          const code = ((req as MediaApplication).promo_code as string).toUpperCase();
          const cur = await supabase.from('promo_codes').select('id, used_count').eq('code', code).maybeSingle();
          if (cur.data) {
            await supabase.from('promo_codes').update({ used_count: ((cur.data as { used_count: number }).used_count || 0) + 1 }).eq('id', (cur.data as { id: string }).id);
          }
        }
      }
    }

    const { error } = await supabase
      .from('media_applications')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) {
      setPaymentRequests(paymentRequests.map(p => p.id === id ? { ...p, status, reviewed_at: new Date().toISOString() } : p));
    } else {
      alert('Xatolik: ' + error.message);
    }
    setActionLoading(null);
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const subLabels: Record<string, string> = {
    none: 'Obuna yoq',
    '30day': '30 kunlik',
    '90day': '90 kunlik',
    lifetime: 'Umrbodlik',
  };

  const planLabels: Record<string, string> = {
    '30day': '30 kunlik',
    '90day': '90 kunlik',
    lifetime: 'Umrbodlik',
  };

  const tabs: { id: Tab; label: string; icon: typeof Users; count: number }[] = [
    { id: 'users', label: 'Foydalanuvchilar', icon: Users, count: users.length },
    { id: 'news', label: 'Yangliklar', icon: Newspaper, count: news.length },
    { id: 'media', label: 'Media so\'rovlar', icon: Megaphone, count: mediaApps.filter(a => a.status === 'pending').length },
    { id: 'payments', label: 'To\'lovlar', icon: CreditCard, count: paymentRequests.filter(p => p.status === 'pending').length },
    { id: 'promo', label: 'Promokodlar', icon: Star, count: promos.filter(p => p.is_active).length },
    { id: 'prices', label: 'Narxlar', icon: CreditCard, count: prices.length },
  ];

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-warning-500 to-warning-700 flex items-center justify-center shadow-lg shadow-warning-500/30">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-3xl text-white">Admin panel</h1>
            <p className="text-sm text-gray-400">Barcha hisoblarni boshqaring</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="glass rounded-2xl p-1.5 flex gap-1 mb-6 overflow-x-auto no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 min-w-fit px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                tab === t.id
                  ? 'bg-warning-500/15 text-warning-300 border border-warning-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.count > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-xs">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
          </div>
        ) : (
          <>
            {/* USERS TAB */}
            {tab === 'users' && (
              <div>
                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Foydalanuvchi qidirish..."
                    className="glass-input w-full pl-12 pr-4 py-3 text-sm"
                  />
                </div>

                <div className="space-y-3">
                  {filteredUsers.map((u) => (
                    <div key={u.id} className="glass-card p-4 sm:p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        {/* User info */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-700/20 border border-primary-500/20 flex items-center justify-center flex-shrink-0">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
                            ) : (
                              <Users className="w-5 h-5 text-primary-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-white truncate">{u.username}</h3>
                              {u.is_admin && (
                                <span className="px-1.5 py-0.5 rounded bg-warning-500/10 text-warning-300 text-xs font-mono">ADMIN</span>
                              )}
                              {u.is_blocked && (
                                <span className="px-1.5 py-0.5 rounded bg-error-500/10 text-error-300 text-xs font-mono">BLOCK</span>
                              )}
                            </div>
                            {u.email && (
                              <p className="text-xs text-gray-500 truncate mt-0.5">{u.email}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                              <span className="flex items-center gap-1">
                                <Crown className="w-3 h-3" />
                                {subLabels[u.subscription_type]}
                              </span>
                              {u.subscription_expires_at && u.subscription_type !== 'lifetime' && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(u.subscription_expires_at).toLocaleDateString('uz-UZ')}
                                </span>
                              )}
                              {u.hwid && (
                                <span className="flex items-center gap-1 font-mono text-gray-500 truncate">
                                  <Cpu className="w-3 h-3" />
                                  HWID: {u.hwid.slice(0, 12)}...
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2">
                          {/* + button: Assign subscription */}
                          <button
                            onClick={() => openSubModal(u.id)}
                            disabled={actionLoading === u.id}
                            className="w-9 h-9 rounded-xl glass-card text-xs font-medium text-success-300 hover:bg-success-500/10 transition-all flex items-center justify-center disabled:opacity-30"
                            title="Obuna berish"
                          >
                            <Plus className="w-4 h-4" />
                          </button>

                          {/* - button: Remove subscription */}
                          <button
                            onClick={() => removeSubscription(u.id)}
                            disabled={actionLoading === u.id || u.subscription_type === 'none'}
                            className="w-9 h-9 rounded-xl glass-card text-xs font-medium text-error-300 hover:bg-error-500/10 transition-all flex items-center justify-center disabled:opacity-30"
                            title="Obunani olib tashlash"
                          >
                            <Minus className="w-4 h-4" />
                          </button>

                          {/* Reset HWID */}
                          <button
                            onClick={() => resetHwid(u.id)}
                            disabled={actionLoading === u.id || !u.hwid}
                            className="w-9 h-9 rounded-xl glass-card text-xs font-medium text-secondary-300 hover:bg-secondary-500/10 transition-all flex items-center justify-center disabled:opacity-30"
                            title="HWID tozalash"
                          >
                            <Key className="w-4 h-4" />
                          </button>

                          {/* Block/Unblock toggle */}
                          <button
                            onClick={() => toggleBlock(u.id, u.is_blocked)}
                            disabled={actionLoading === u.id || u.is_admin}
                            className={`w-9 h-9 rounded-xl glass-card text-xs font-medium transition-all flex items-center justify-center disabled:opacity-30 ${
                              u.is_blocked
                                ? 'text-success-300 hover:bg-success-500/10'
                                : 'text-error-300 hover:bg-error-500/10'
                            }`}
                            title={u.is_blocked ? 'Blokdani ochish' : 'Bloklash'}
                          >
                            {u.is_blocked ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                          </button>

                          {actionLoading === u.id && <Loader2 className="w-4 h-4 animate-spin text-primary-400 self-center" />}
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <div className="glass-card p-8 text-center text-gray-400">Foydalanuvchi topilmadi.</div>
                  )}
                </div>
              </div>
            )}

            {/* NEWS TAB */}
            {tab === 'news' && (
              <div>
                <div className="flex justify-end mb-4">
                  <button
                    onClick={() => setShowNewsModal(true)}
                    className="btn-primary text-sm py-2.5 px-5 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
Yangilik qo'shish
                  </button>
                </div>

                <div className="space-y-3">
                  {news.map((item) => (
                    <div key={item.id} className="glass-card p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {item.version && (
                              <span className="px-2 py-0.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-xs text-primary-300 font-mono">
                                v{item.version}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">{new Date(item.created_at).toLocaleDateString('uz-UZ')}</span>
                          </div>
                          <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                          <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">{item.content}</p>
                        </div>
                        <button
                          onClick={() => deleteNews(item.id)}
                          className="p-2 rounded-xl glass-card text-error-400 hover:bg-error-500/10 transition-all flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {news.length === 0 && (
                    <div className="glass-card p-8 text-center text-gray-400">Yangiliklar yo'q.</div>
                  )}
                </div>

                {/* News modal */}
                {showNewsModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowNewsModal(false)}>
                    <div className="absolute inset-0 bg-black/70" />
                    <div className="relative glass-strong rounded-2xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-display font-bold text-xl text-white">Yangilik qo'shish</h3>
                        <button onClick={() => setShowNewsModal(false)} className="w-8 h-8 rounded-lg glass-card flex items-center justify-center">
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Sarlavha</label>
                          <input
                            type="text"
                            value={newsForm.title}
                            onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })}
                            placeholder="Yangi modul qo'shildi"
                            className="glass-input w-full px-4 py-3 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Versiya (ixtiyoriy)</label>
                          <input
                            type="text"
                            value={newsForm.version}
                            onChange={(e) => setNewsForm({ ...newsForm, version: e.target.value })}
                            placeholder="1.0.1"
                            className="glass-input w-full px-4 py-3 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Matn</label>
                          <textarea
                            value={newsForm.content}
                            onChange={(e) => setNewsForm({ ...newsForm, content: e.target.value })}
                            placeholder="Yangilik haqida batafsil..."
                            rows={5}
                            className="glass-input w-full px-4 py-3 text-sm resize-none"
                          />
                        </div>
                        <button
                          onClick={createNews}
                          disabled={actionLoading === 'news'}
                          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {actionLoading === 'news' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Qo\'shish'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MEDIA TAB */}
            {tab === 'media' && (
              <div className="space-y-3">
                {mediaApps.map((app) => (
                  <div key={app.id} className="glass-card p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-white">{app.channel_name}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            app.status === 'pending' ? 'bg-warning-500/10 border border-warning-500/20 text-warning-300' :
                            app.status === 'approved' ? 'bg-success-500/10 border border-success-500/20 text-success-300' :
                            'bg-error-500/10 border border-error-500/20 text-error-300'
                          }`}>
                            {app.status === 'pending' ? 'Kutilmoqda' : app.status === 'approved' ? 'Tasdiqlangan' : 'Rad etilgan'}
                          </span>
                        </div>
                        <a href={app.channel_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-300 hover:text-primary-200 block mb-2">
                          {app.channel_url}
                        </a>
                        <div className="flex gap-4 text-xs text-gray-400 mb-2">
                          <span>Obunachilar: {app.subscriber_count}</span>
                          <span>O'rtacha ko'rishlar: {app.avg_views}</span>
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed">{app.description}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(app.created_at).toLocaleDateString('uz-UZ')}
                        </p>
                      </div>

                      {app.status === 'pending' && (
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => reviewMediaApp(app.id, 'approved')}
                            disabled={actionLoading === app.id}
                            className="px-3 py-2 rounded-xl glass-card text-xs font-medium text-success-300 hover:bg-success-500/10 transition-all flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Tasdiqlash
                          </button>
                          <button
                            onClick={() => reviewMediaApp(app.id, 'rejected')}
                            disabled={actionLoading === app.id}
                            className="px-3 py-2 rounded-xl glass-card text-xs font-medium text-error-300 hover:bg-error-500/10 transition-all flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            Rad etish
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {mediaApps.length === 0 && (
                  <div className="glass-card p-8 text-center text-gray-400">Media so'rovlar yo'q.</div>
                )}
              </div>
            )}

            {/* PAYMENTS TAB */}
            {tab === 'payments' && (
              <div className="space-y-3">
                {paymentRequests.map((req) => (
                  <div key={req.id} className="glass-card p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-white">
                            {req.channel_name || 'Noma\'lum'}
                          </h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            req.status === 'pending' ? 'bg-warning-500/10 border border-warning-500/20 text-warning-300' :
                            req.status === 'approved' ? 'bg-success-500/10 border border-success-500/20 text-success-300' :
                            'bg-error-500/10 border border-error-500/20 text-error-300'
                          }`}>
                            {req.status === 'pending' ? 'Kutilmoqda' : req.status === 'approved' ? 'Tasdiqlangan' : 'Rad etilgan'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 mb-2">
                          <span className="flex items-center gap-1">
                            <Crown className="w-3 h-3" />
                            {planLabels[req.channel_url] || req.channel_url}
                          </span>
                          <span className="flex items-center gap-1">
                            <CreditCard className="w-3 h-3" />
                            {req.avg_views.toLocaleString()} so'm
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(req.created_at).toLocaleDateString('uz-UZ')} {new Date(req.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {((req as MediaApplication).promo_code || (req as MediaApplication).discount_percent) && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1">
                            {(req as MediaApplication).promo_code && (
                              <span className="px-2 py-0.5 rounded-full bg-secondary-500/10 border border-secondary-500/20 text-secondary-300 font-mono">
                                {(req as MediaApplication).promo_code}
                              </span>
                            )}
                            {(req as MediaApplication).discount_percent ? (
                              <span className="text-success-300 font-medium">
                                -{(req as MediaApplication).discount_percent}% chegirma
                              </span>
                            ) : null}
                          </div>
                        )}
                        {req.channel_url === 'hwid_reset' && (
                          <p className="text-xs text-amber-300 mt-1 flex items-center gap-1">
                            <Cpu className="w-3 h-3" /> HWID Yangilash so'rovi
                          </p>
                        )}
                        {req.description && req.description.startsWith('data:') && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-500 mb-1">Skrinshot:</p>
                            <img
                              src={req.description}
                              alt="To'lov cheki"
                              className="max-w-xs max-h-48 rounded-xl border border-white/10 cursor-pointer hover:scale-105 transition-transform"
                              onClick={() => window.open(req.description!, '_blank')}
                            />
                          </div>
                        )}
                      </div>

                      {req.status === 'pending' && (
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => reviewPayment(req.id, 'approved')}
                            disabled={actionLoading === req.id}
                            className="px-3 py-2 rounded-xl glass-card text-xs font-medium text-success-300 hover:bg-success-500/10 transition-all flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Tasdiqlash
                          </button>
                          <button
                            onClick={() => reviewPayment(req.id, 'rejected')}
                            disabled={actionLoading === req.id}
                            className="px-3 py-2 rounded-xl glass-card text-xs font-medium text-error-300 hover:bg-error-500/10 transition-all flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            Rad etish
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {paymentRequests.length === 0 && (
                  <div className="glass-card p-8 text-center text-gray-400">To'lov so'rovlar yo'q.</div>
                )}
              </div>
            )}

            {/* PRICES TAB */}
            {tab === 'prices' && (
              <div className="space-y-3">
                <div className="glass-card p-5">
                  <h3 className="font-semibold text-white mb-1">Obuna va HWID narxlari</h3>
                  <p className="text-xs text-gray-400 mb-4">Narxni tahrirlab Saqlash bosing — saytdagi Obunalar bo'limi darhol yangilanadi.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {prices.map((pr) => (
                      <div key={pr.id} className="glass-card p-4">
                        <p className="text-xs text-gray-400 mb-2 font-mono">{pr.id}</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={priceEdits[pr.id] ?? String(pr.price)}
                            onChange={(e) => setPriceEdits({ ...priceEdits, [pr.id]: e.target.value })}
                            className="glass-input flex-1 px-3 py-2.5 text-sm"
                          />
                          <span className="px-3 py-2 rounded-xl bg-white/5 text-xs text-gray-400 self-center">so'm</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={savePrices}
                    disabled={actionLoading === 'prices'}
                    className="btn-primary mt-4 w-full sm:w-auto px-6 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading === 'prices' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Saqlash
                  </button>
                </div>
              </div>
            )}

            {/* PROMO TAB */}
            {tab === 'promo' && (
              <div className="space-y-3">
                <div className="glass-card p-5">
                  <h3 className="font-semibold text-white mb-4">Yangi promokod</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <input
                      type="text"
                      value={promoForm.code}
                      onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
                      placeholder="Kod (masalan: CHEGIRMA10)"
                      className="glass-input px-4 py-3 text-sm uppercase"
                    />
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={promoForm.discount}
                      onChange={(e) => setPromoForm({ ...promoForm, discount: e.target.value })}
                      placeholder="Chegirma %"
                      className="glass-input px-4 py-3 text-sm"
                    />
                    <input
                      type="number"
                      min={1}
                      value={promoForm.maxUses}
                      onChange={(e) => setPromoForm({ ...promoForm, maxUses: e.target.value })}
                      placeholder="Limit (bo'sh=cheksiz)"
                      className="glass-input px-4 py-3 text-sm"
                    />
                    <button
                      onClick={createPromo}
                      disabled={actionLoading === 'promo'}
                      className="btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {actionLoading === 'promo' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Yaratish
                    </button>
                  </div>
                </div>

                {promos.map((p) => (
                  <div key={p.id} className="glass-card p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-white">{p.code}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active ? 'bg-success-500/10 border border-success-500/20 text-success-300' : 'bg-gray-500/10 border border-gray-500/20 text-gray-400'}`}>
                            {p.is_active ? 'Faol' : "O'chiq"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          -{p.discount_percent}% chegirma • Ishlatilgan: {p.used_count}{p.max_uses ? `/${p.max_uses}` : ' (cheksiz)'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => togglePromo(p)}
                          disabled={actionLoading === p.id}
                          className="px-3 py-2 rounded-xl glass-card text-xs font-medium text-secondary-300 hover:bg-secondary-500/10 transition-all disabled:opacity-50"
                        >
                          {p.is_active ? "O'chirish" : 'Yoqish'}
                        </button>
                        <button
                          onClick={() => deletePromo(p.id)}
                          disabled={actionLoading === p.id}
                          className="px-3 py-2 rounded-xl glass-card text-xs font-medium text-error-300 hover:bg-error-500/10 transition-all disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {promos.length === 0 && (
                  <div className="glass-card p-8 text-center text-gray-400">Promokodlar yo'q.</div>
                )}
              </div>
            )}
          </>
        )}

        {/* Subscription Modal */}
        {showSubModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowSubModal(false)}>
            <div className="absolute inset-0 bg-black/70" />
            <div className="relative glass-strong rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display font-bold text-xl text-white">Obuna berish</h3>
                <button onClick={() => setShowSubModal(false)} className="w-8 h-8 rounded-lg glass-card flex items-center justify-center">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => assignFromModal('30day')}
                  disabled={actionLoading === selectedUserId}
                  className="w-full py-3 rounded-xl glass-card text-sm font-medium text-primary-300 hover:bg-primary-500/10 transition-all flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  30 kunlik obuna
                </button>
                <button
                  onClick={() => assignFromModal('90day')}
                  disabled={actionLoading === selectedUserId}
                  className="w-full py-3 rounded-xl glass-card text-sm font-medium text-secondary-300 hover:bg-secondary-500/10 transition-all flex items-center justify-center gap-2"
                >
                  <Star className="w-4 h-4" />
                  90 kunlik obuna
                </button>
                <button
                  onClick={() => assignFromModal('lifetime')}
                  disabled={actionLoading === selectedUserId}
                  className="w-full py-3 rounded-xl glass-card text-sm font-medium text-warning-300 hover:bg-warning-500/10 transition-all flex items-center justify-center gap-2"
                >
                  <Crown className="w-4 h-4" />
                  Umrbodlik obuna
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
