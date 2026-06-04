import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Building,
  MapPin,
  Users,
  X,
  Copy,
  Check,
  User,
  Lock,
  Globe,
  Clock,
  Instagram,
  Upload,
} from 'lucide-react';

import { FirmSidebar } from './FirmSidebar';
import { authService } from '../authService';

export function FirmSettings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'firm' | 'personal'>('firm');
  
  // Firm Profile State
  const [firmName, setFirmName] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState(46.77);
  const [longitude, setLongitude] = useState(23.59);
  const [openTime, setOpenTime] = useState(8.0);
  const [closeTime, setCloseTime] = useState(18.0);
  const [imageUrl, setImageUrl] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');

  // Personal Profile State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [personalData, setPersonalData] = useState({
    username: '',
    email: '',
    phone: '',
    avatar_url: '',
  });
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  // Access Code Modal State
  const [showAccessCodeModal, setShowAccessCodeModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 1. Fetch Firm Profile
    fetch('/api/firms/me', { headers: authService.getAuthHeaders() })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data) {
          setFirmName(data.name || '');
          setOpenTime(data.open_time ?? 8.0);
          setCloseTime(data.close_time ?? 18.0);
          
          // Parse JSON description fields
          setBusinessDescription(data.description_text || data.description || '');
          setLocation(data.location || '');
          setLatitude(data.latitude ?? 46.7712);
          setLongitude(data.longitude ?? 23.5894);
          setImageUrl(data.image || '');
          setTiktokUrl(data.social_tiktok || '');
          setInstagramUrl(data.social_instagram || '');
        }
      });

    // 2. Fetch Personal Admin Info
    authService.fetchCurrentUser().then(user => {
      if (user) {
        setCurrentUser(user);
        setPersonalData({
          username: user.username || '',
          email: user.email || '',
          phone: user.phone || '',
          avatar_url: user.avatar_url || '',
        });
      }
    });
  }, []);

  const handleSaveFirmProfile = async () => {
    try {
      const res = await fetch('/api/firms/me', {
        method: 'PUT',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({
          name: firmName,
          open_time: openTime,
          close_time: closeTime,
          location: location,
          latitude: latitude,
          longitude: longitude,
          category: 'Haircut & Styling', // default
          image: imageUrl,
          description_text: businessDescription,
          social_tiktok: tiktokUrl,
          social_instagram: instagramUrl,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to update business profile');
        return;
      }
      alert('Business profile updated successfully!');
    } catch (err) {
      alert('Error updating business profile');
    }
  };

  const handleSavePersonalProfile = async () => {
    try {
      const res = await fetch('/api/users/me', {
        method: 'PUT',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({
          username: personalData.username,
          email: personalData.email,
          phone: personalData.phone,
          avatar_url: personalData.avatar_url,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to update personal profile');
        return;
      }
      const updated = await res.json();
      setCurrentUser(updated);
      alert('Personal profile updated successfully!');
    } catch (err) {
      alert('Error updating personal profile');
    }
  };

  const handleSavePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      alert('New passwords do not match');
      return;
    }
    try {
      const res = await fetch('/api/users/me', {
        method: 'PUT',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({
          current_password: passwords.current,
          new_password: passwords.new,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to change password');
        return;
      }
      setPasswords({ current: '', new: '', confirm: '' });
      alert('Password updated successfully!');
    } catch (err) {
      alert('Error updating password');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sb_access_token')}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Upload failed');
        return;
      }

      const data = await res.json();
      setImageUrl(data.url);
      alert('Photo uploaded successfully!');
    } catch (err) {
      alert('Error uploading file');
    }
  };

  const generateAccessCode = async () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 24 * 60 * 60 * 1000; // 24h
    
    try {
      const res = await fetch('/api/auth/access-code', {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({ code, expiry }),
      });
      if (res.ok) {
        setGeneratedCode(code);
        setShowAccessCodeModal(true);
        setCopied(false);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save access code');
      }
    } catch (err) {
      alert('Error generating access code');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-screen bg-white dark:bg-background transition-colors duration-200">
      <FirmSidebar />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          <h1 className="text-4xl mb-2 text-[#013220] dark:text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>
            Settings
          </h1>
          <p className="text-[#013220]/60 dark:text-foreground/60 mb-8" style={{ fontFamily: 'Inter, sans-serif' }}>
            Manage your business profile, staff codes, and personal security settings.
          </p>

          {/* Two Tab Navigation Headers */}
          <div className="flex gap-4 border-b border-[#013220]/15 dark:border-border mb-8">
            <button
              onClick={() => setActiveTab('firm')}
              className={`pb-4 px-2 font-semibold text-lg transition-colors relative ${
                activeTab === 'firm'
                  ? 'text-[#013220] dark:text-foreground border-b-2 border-[#013220] dark:border-primary'
                  : 'text-[#013220]/50 dark:text-foreground/50 hover:text-[#013220] dark:hover:text-foreground'
              }`}
            >
              Firm Profile
            </button>
            <button
              onClick={() => setActiveTab('personal')}
              className={`pb-4 px-2 font-semibold text-lg transition-colors relative ${
                activeTab === 'personal'
                  ? 'text-[#013220] dark:text-foreground border-b-2 border-[#013220] dark:border-primary'
                  : 'text-[#013220]/50 dark:text-foreground/50 hover:text-[#013220] dark:hover:text-foreground'
              }`}
            >
              Personal Profile
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'firm' ? (
            <div className="space-y-8">
              {/* Firm Info Card */}
              <div className="bg-[#F5F5DC] dark:bg-card rounded-[32px] p-8 border border-[#013220]/5 dark:border-border">
                <div className="flex items-center gap-3 mb-6">
                  <Building className="text-[#013220] dark:text-foreground" size={28} />
                  <h2 className="text-2xl text-[#013220] dark:text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>
                    Business Details
                  </h2>
                </div>

                <div className="space-y-6">
                  {/* Business Name */}
                  <div>
                    <label className="block text-sm font-semibold text-[#013220] dark:text-foreground mb-2">Business Name</label>
                    <input
                      type="text"
                      value={firmName}
                      onChange={(e) => setFirmName(e.target.value)}
                      className="w-full px-6 py-4 bg-white dark:bg-background border border-[#013220]/20 dark:border-border rounded-[24px] focus:outline-none text-[#013220] dark:text-foreground"
                    />
                  </div>

                  {/* Business Description */}
                  <div>
                    <label className="block text-sm font-semibold text-[#013220] dark:text-foreground mb-2">Business Description</label>
                    <textarea
                      value={businessDescription}
                      onChange={(e) => setBusinessDescription(e.target.value)}
                      rows={4}
                      className="w-full px-6 py-4 bg-white dark:bg-background border border-[#013220]/20 dark:border-border rounded-[24px] focus:outline-none text-[#013220] dark:text-foreground resize-none"
                    />
                  </div>

                  {/* Location Address */}
                  <div>
                    <label className="block text-sm font-semibold text-[#013220] dark:text-foreground mb-2">Location Address</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-[#013220]/40" size={20} />
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. Str. Primăverii 2, Cluj-Napoca"
                        className="w-full pl-12 pr-6 py-4 bg-white dark:bg-background border border-[#013220]/20 dark:border-border rounded-[24px] focus:outline-none text-[#013220] dark:text-foreground"
                      />
                    </div>
                  </div>

                  {/* Coordinates for Map */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#013220] dark:text-foreground mb-2">Latitude</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={latitude}
                        onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
                        className="w-full px-6 py-4 bg-white dark:bg-background border border-[#013220]/20 dark:border-border rounded-[24px] focus:outline-none text-[#013220] dark:text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#013220] dark:text-foreground mb-2">Longitude</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={longitude}
                        onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
                        className="w-full px-6 py-4 bg-white dark:bg-background border border-[#013220]/20 dark:border-border rounded-[24px] focus:outline-none text-[#013220] dark:text-foreground"
                      />
                    </div>
                  </div>

                  {/* Operating Hours */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#013220] dark:text-foreground mb-2">Open Time (Hour)</label>
                      <select
                        value={openTime}
                        onChange={(e) => setOpenTime(parseFloat(e.target.value))}
                        className="w-full px-6 py-4 bg-white dark:bg-background border border-[#013220]/20 dark:border-border rounded-[24px] focus:outline-none text-[#013220] dark:text-foreground"
                      >
                        {Array.from({ length: 24 }).map((_, i) => (
                          <option key={i} value={i}>{`${i.toString().padStart(2, '0')}:00`}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#013220] dark:text-foreground mb-2">Close Time (Hour)</label>
                      <select
                        value={closeTime}
                        onChange={(e) => setCloseTime(parseFloat(e.target.value))}
                        className="w-full px-6 py-4 bg-white dark:bg-background border border-[#013220]/20 dark:border-border rounded-[24px] focus:outline-none text-[#013220] dark:text-foreground"
                      >
                        {Array.from({ length: 24 }).map((_, i) => (
                          <option key={i} value={i}>{`${i.toString().padStart(2, '0')}:00`}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Social Links */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#013220] dark:text-foreground mb-2">TikTok Username/URL</label>
                      <div className="relative">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-[#013220]/40" size={20} />
                        <input
                          type="text"
                          value={tiktokUrl}
                          onChange={(e) => setTiktokUrl(e.target.value)}
                          placeholder="tiktok.com/@username"
                          className="w-full pl-12 pr-6 py-4 bg-white dark:bg-background border border-[#013220]/20 dark:border-border rounded-[24px] focus:outline-none text-[#013220] dark:text-foreground"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#013220] dark:text-foreground mb-2">Instagram Username/URL</label>
                      <div className="relative">
                        <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 text-[#013220]/40" size={20} />
                        <input
                          type="text"
                          value={instagramUrl}
                          onChange={(e) => setInstagramUrl(e.target.value)}
                          placeholder="instagram.com/username"
                          className="w-full pl-12 pr-6 py-4 bg-white dark:bg-background border border-[#013220]/20 dark:border-border rounded-[24px] focus:outline-none text-[#013220] dark:text-foreground"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Photo Gallery & Uploads */}
                  <div>
                    <label className="block text-sm font-semibold text-[#013220] dark:text-foreground mb-2">Business Photo URL</label>
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://example.com/shop.jpg"
                      className="w-full px-6 py-4 bg-white dark:bg-background border border-[#013220]/20 dark:border-border rounded-[24px] focus:outline-none text-[#013220] dark:text-foreground mb-3"
                    />
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-background border border-[#013220]/20 dark:border-border text-[#013220] dark:text-foreground rounded-[20px] cursor-pointer hover:bg-black/5">
                        <Upload size={18} />
                        Upload Local Image
                        <input type="file" onChange={handleImageUpload} className="hidden" accept="image/*" />
                      </label>
                      {imageUrl && (
                        <div className="w-16 h-16 rounded-[12px] overflow-hidden border border-border">
                          <img src={imageUrl} alt="Firm photo" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveFirmProfile}
                  className="mt-6 px-8 py-3 bg-[#013220] dark:bg-primary text-white dark:text-primary-foreground rounded-[20px] hover:bg-[#013220]/90 transition-all shadow-md hover:shadow-lg"
                >
                  Save Business Changes
                </button>
              </div>

              {/* Staff Management Section */}
              <div className="bg-[#F5F5DC] dark:bg-card rounded-[32px] p-8 border border-[#013220]/5 dark:border-border">
                <div className="flex items-center gap-3 mb-6">
                  <Users className="text-[#013220] dark:text-foreground" size={28} />
                  <h2 className="text-2xl text-[#013220] dark:text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>
                    Staff Onboarding Code
                  </h2>
                </div>
                <p className="text-[#013220]/60 dark:text-foreground/60 mb-6" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Generate onboarding access codes to registers new employees to your business dashboard.
                </p>
                <button
                  onClick={generateAccessCode}
                  className="px-8 py-4 bg-[#D4AF37] text-white rounded-[20px] hover:bg-[#D4AF37]/90 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                >
                  <Users size={20} />
                  Generate Employee Access Code
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Personal Details */}
              <div className="bg-[#F5F5DC] dark:bg-card rounded-[32px] p-8 border border-[#013220]/5 dark:border-border">
                <div className="flex items-center gap-3 mb-6">
                  <User className="text-[#013220] dark:text-foreground" size={28} />
                  <h2 className="text-2xl text-[#013220] dark:text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>
                    Personal Information
                  </h2>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#013220] dark:text-foreground mb-2">Username</label>
                      <input
                        type="text"
                        value={personalData.username}
                        onChange={(e) => setPersonalData({ ...personalData, username: e.target.value })}
                        className="w-full px-6 py-4 bg-white dark:bg-background border border-[#013220]/20 dark:border-border rounded-[24px] focus:outline-none text-[#013220] dark:text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#013220] dark:text-foreground mb-2">Email Address</label>
                      <input
                        type="email"
                        value={personalData.email}
                        onChange={(e) => setPersonalData({ ...personalData, email: e.target.value })}
                        className="w-full px-6 py-4 bg-white dark:bg-background border border-[#013220]/20 dark:border-border rounded-[24px] focus:outline-none text-[#013220] dark:text-foreground"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSavePersonalProfile}
                  className="mt-6 px-8 py-3 bg-[#013220] dark:bg-primary text-white dark:text-primary-foreground rounded-[20px] hover:bg-[#013220]/90 transition-all shadow-md hover:shadow-lg"
                >
                  Save Profile Changes
                </button>
              </div>

              {/* Password Change */}
              <div className="bg-[#F5F5DC] dark:bg-card rounded-[32px] p-8 border border-[#013220]/5 dark:border-border">
                <div className="flex items-center gap-3 mb-6">
                  <Lock className="text-[#013220] dark:text-foreground" size={28} />
                  <h2 className="text-2xl text-[#013220] dark:text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>
                    Security Details
                  </h2>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-[#013220] dark:text-foreground mb-2">Current Password</label>
                    <input
                      type="password"
                      value={passwords.current}
                      onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                      className="w-full px-6 py-4 bg-white dark:bg-background border border-[#013220]/20 dark:border-border rounded-[24px] focus:outline-none text-[#013220] dark:text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#013220] dark:text-foreground mb-2">New Password</label>
                    <input
                      type="password"
                      value={passwords.new}
                      onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                      className="w-full px-6 py-4 bg-white dark:bg-background border border-[#013220]/20 dark:border-border rounded-[24px] focus:outline-none text-[#013220] dark:text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#013220] dark:text-foreground mb-2">Confirm New Password</label>
                    <input
                      type="password"
                      value={passwords.confirm}
                      onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                      className="w-full px-6 py-4 bg-white dark:bg-background border border-[#013220]/20 dark:border-border rounded-[24px] focus:outline-none text-[#013220] dark:text-foreground"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSavePassword}
                  className="mt-6 px-8 py-3 bg-[#013220] dark:bg-primary text-white dark:text-primary-foreground rounded-[20px] hover:bg-[#013220]/90 transition-all"
                >
                  Change Password
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Employee Access Code Modal */}
      {showAccessCodeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-[32px] shadow-2xl p-8 max-w-md mx-4 relative">
            <button
              onClick={() => setShowAccessCodeModal(false)}
              className="absolute top-6 right-6 text-[#013220]/40 hover:text-[#013220] transition-colors"
            >
              <X size={24} />
            </button>

            <div className="text-center">
              <div className="w-16 h-16 bg-[#50C878] rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="text-white" size={32} />
              </div>

              <h3 className="text-2xl mb-2 text-[#013220]" style={{ fontFamily: 'Playfair Display, serif' }}>
                Employee Access Code
              </h3>

              <p className="text-[#013220]/60 mb-6" style={{ fontFamily: 'Inter, sans-serif' }}>
                Share this 6-digit code with your new employee
              </p>

              <div className="bg-[#F5F5DC] rounded-[24px] p-6 mb-6">
                <div className="text-5xl font-bold text-[#013220] tracking-widest mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {generatedCode}
                </div>
                <p className="text-xs text-[#013220]/50">Valid for 24 hours</p>
              </div>

              <button
                onClick={copyToClipboard}
                className="w-full py-3 bg-[#013220] text-white rounded-[20px] hover:bg-[#013220]/90 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {copied ? (
                  <>
                    <Check size={20} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={20} />
                    Copy Code
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
