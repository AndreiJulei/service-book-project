import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Calendar,
  MessageSquare,
  Settings,
  User,
  Lock,
  Bell,
  Moon,
  LogOut,
  Eye,
  EyeOff,
  Palette,
} from 'lucide-react';
import { authService } from '../authService';

export function EmployeeSettings() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [mobileNotifications, setMobileNotifications] = useState(true);
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [employeeProfile, setEmployeeProfile] = useState<any>(null);
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    username: '',
    email: '',
    phone: '',
    avatar_url: '',
    name: '',
    color: '#000000',
  });

  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  useEffect(() => {
    // Fetch user and employee profiles
    authService.fetchCurrentUser().then(user => {
      if (user) {
        setCurrentUser(user);
        
        // Fetch employee details
        fetch('/api/employees/me', { headers: authService.getAuthHeaders() })
          .then(res => (res.ok ? res.json() : null))
          .then(emp => {
            if (emp) {
              setEmployeeProfile(emp);
              setProfileData({
                username: user.username || '',
                email: user.email || '',
                phone: user.phone || '',
                avatar_url: user.avatar_url || '',
                name: emp.name || '',
                color: emp.color || '#000000',
              });
            }
          });
      }
    });
  }, []);

  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/\d/.test(password)) strength += 25;
    if (/[^a-zA-Z\d]/.test(password)) strength += 25;
    return strength;
  };

  const handlePasswordChange = (field: string, value: string) => {
    const newPasswords = { ...passwords, [field]: value };
    setPasswords(newPasswords);
    if (field === 'new') {
      setPasswordStrength(calculatePasswordStrength(value));
    }
  };

  const getStrengthColor = () => {
    if (passwordStrength >= 75) return 'bg-[#50C878]';
    if (passwordStrength >= 50) return 'bg-[#D4AF37]';
    return 'bg-[#d4183d]';
  };

  const getStrengthText = () => {
    if (passwordStrength >= 75) return 'Strong';
    if (passwordStrength >= 50) return 'Medium';
    if (passwordStrength > 0) return 'Weak';
    return 'Enter password';
  };

  const handleSaveProfile = async () => {
    try {
      // 1. Save user details
      const userRes = await fetch('/api/users/me', {
        method: 'PUT',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({
          username: profileData.username,
          email: profileData.email,
          phone: profileData.phone,
          avatar_url: profileData.avatar_url,
        }),
      });
      if (!userRes.ok) {
        const err = await userRes.json();
        alert(err.error || 'Failed to update user profile');
        return;
      }
      const updatedUser = await userRes.json();
      setCurrentUser(updatedUser);

      // 2. Save employee details (name, color)
      if (employeeProfile) {
        const empRes = await fetch(`/api/employees/${employeeProfile.id}`, {
          method: 'PUT',
          headers: authService.getAuthHeaders(),
          body: JSON.stringify({
            name: profileData.name,
            color: profileData.color,
          }),
        });
        if (!empRes.ok) {
          const err = await empRes.json();
          alert(err.error || 'Failed to update employee details');
          return;
        }
        const updatedEmp = await empRes.json();
        setEmployeeProfile(updatedEmp);
      }

      setIsEditingProfile(false);
      alert('Profile updated successfully');
    } catch (err) {
      alert('Error saving profile changes');
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
        alert(err.error || 'Failed to update password');
        return;
      }
      setShowPasswordFields(false);
      setPasswords({ current: '', new: '', confirm: '' });
      setPasswordStrength(0);
      alert('Password updated successfully');
    } catch (err) {
      alert('Error saving password change');
    }
  };

  const toggleDarkMode = () => {
    const nextVal = !darkMode;
    setDarkMode(nextVal);
    if (nextVal) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-background transition-colors duration-200">
      {/* Left Sidebar - Navigation */}
      <div className="w-20 bg-[#F5F5DC] dark:bg-sidebar flex flex-col items-center py-8 gap-8 border-r border-[#013220]/10 dark:border-sidebar-border">
        <button
          onClick={() => navigate('/employee/schedule')}
          className="p-4 rounded-[16px] text-[#013220] dark:text-sidebar-foreground hover:bg-white dark:hover:bg-sidebar-accent transition-colors"
        >
          <Calendar size={24} />
        </button>
        <button
          onClick={() => navigate('/employee/chats')}
          className="p-4 rounded-[16px] text-[#013220] dark:text-sidebar-foreground hover:bg-white dark:hover:bg-sidebar-accent transition-colors"
        >
          <MessageSquare size={24} />
        </button>
        <button
          onClick={() => navigate('/employee/settings')}
          className="p-4 rounded-[16px] bg-[#013220] dark:bg-sidebar-primary text-white"
        >
          <Settings size={24} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          <h1 className="text-4xl mb-2 text-[#013220] dark:text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>
            Employee Settings
          </h1>
          <p className="text-[#013220]/60 dark:text-foreground/60 mb-8" style={{ fontFamily: 'Inter, sans-serif' }}>
            Manage your schedule profile, color settings, and account security
          </p>

          {/* Profile Section */}
          <div className="mb-8 bg-[#F5F5DC] dark:bg-card rounded-[32px] p-6 border border-[#013220]/5 dark:border-border">
            <div className="flex items-center gap-4 mb-6">
              <User className="text-[#013220] dark:text-foreground" size={24} />
              <h2 className="text-2xl text-[#013220] dark:text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>
                Schedule Profile
              </h2>
            </div>

            {!isEditingProfile ? (
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-[#013220] text-white flex items-center justify-center text-3xl font-semibold">
                  {currentUser?.avatar_url ? (
                    <img src={currentUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    profileData.name?.substring(0, 2).toUpperCase() || 'JD'
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-[#013220] dark:text-foreground mb-1">{profileData.name || 'Marcus Chen'}</h3>
                  <p className="text-[#013220]/60 dark:text-foreground/60 mb-1">Email: {currentUser?.email || 'marcus@servicebook.com'}</p>
                  <p className="text-[#013220]/60 dark:text-foreground/60 mb-3">
                    Schedule Color:{' '}
                    <span
                      className="inline-block w-4 h-4 rounded-full ml-1 align-middle border border-white"
                      style={{ backgroundColor: profileData.color }}
                    />{' '}
                    ({profileData.color})
                  </p>
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="px-6 py-2 bg-[#013220] dark:bg-primary text-white dark:text-primary-foreground rounded-[16px] hover:bg-[#013220]/90 dark:hover:opacity-90 transition-colors"
                  >
                    Edit Profile
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#013220] dark:text-foreground mb-2">Display Name</label>
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      className="w-full px-6 py-4 bg-white dark:bg-card border border-[#013220]/20 dark:border-border rounded-[20px] focus:outline-none text-[#013220] dark:text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#013220] dark:text-foreground mb-2">Username</label>
                    <input
                      type="text"
                      value={profileData.username}
                      onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                      className="w-full px-6 py-4 bg-white dark:bg-card border border-[#013220]/20 dark:border-border rounded-[20px] focus:outline-none text-[#013220] dark:text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#013220] dark:text-foreground mb-2">Email</label>
                    <input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      className="w-full px-6 py-4 bg-white dark:bg-card border border-[#013220]/20 dark:border-border rounded-[20px] focus:outline-none text-[#013220] dark:text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#013220] dark:text-foreground mb-2">Phone</label>
                    <input
                      type="text"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      placeholder="e.g. 0740123456"
                      className="w-full px-6 py-4 bg-white dark:bg-card border border-[#013220]/20 dark:border-border rounded-[20px] focus:outline-none text-[#013220] dark:text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#013220] dark:text-foreground mb-2">Avatar URL</label>
                    <input
                      type="text"
                      value={profileData.avatar_url}
                      onChange={(e) => setProfileData({ ...profileData, avatar_url: e.target.value })}
                      placeholder="https://example.com/avatar.png"
                      className="w-full px-6 py-4 bg-white dark:bg-card border border-[#013220]/20 dark:border-border rounded-[20px] focus:outline-none text-[#013220] dark:text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#013220] dark:text-foreground mb-2">Schedule Color Picker</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={profileData.color}
                        onChange={(e) => setProfileData({ ...profileData, color: e.target.value })}
                        className="w-16 h-12 rounded-[10px] cursor-pointer border-0 bg-transparent"
                      />
                      <input
                        type="text"
                        value={profileData.color}
                        onChange={(e) => setProfileData({ ...profileData, color: e.target.value })}
                        className="w-28 px-4 py-2 bg-white dark:bg-card border border-[#013220]/20 dark:border-border rounded-[10px] focus:outline-none text-[#013220] dark:text-foreground"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleSaveProfile}
                    className="px-6 py-3 bg-[#013220] dark:bg-primary text-white dark:text-primary-foreground rounded-[20px] hover:bg-[#013220]/90 transition-colors"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingProfile(false);
                      if (currentUser && employeeProfile) {
                        setProfileData({
                          username: currentUser.username || '',
                          email: currentUser.email || '',
                          phone: currentUser.phone || '',
                          avatar_url: currentUser.avatar_url || '',
                          name: employeeProfile.name || '',
                          color: employeeProfile.color || '#000000',
                        });
                      }
                    }}
                    className="px-6 py-3 bg-white dark:bg-secondary text-[#013220] dark:text-secondary-foreground rounded-[20px] border border-[#013220]/20 dark:border-border"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Security Section */}
          <div className="mb-8 bg-[#F5F5DC] dark:bg-card rounded-[32px] p-6 border border-[#013220]/5 dark:border-border">
            <div className="flex items-center gap-4 mb-6">
              <Lock className="text-[#013220] dark:text-foreground" size={24} />
              <h2 className="text-2xl text-[#013220] dark:text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>
                Security
              </h2>
            </div>

            {!showPasswordFields ? (
              <button
                onClick={() => setShowPasswordFields(true)}
                className="px-6 py-3 bg-[#013220] dark:bg-primary text-white dark:text-primary-foreground rounded-[20px] hover:bg-[#013220]/90 transition-colors"
              >
                Change Password
              </button>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type={showPassword.current ? 'text' : 'password'}
                    placeholder="Current Password"
                    value={passwords.current}
                    onChange={(e) => handlePasswordChange('current', e.target.value)}
                    className="w-full px-6 py-4 bg-white dark:bg-card rounded-[20px] border border-[#013220]/20 dark:border-border focus:outline-none text-[#013220] dark:text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword({ ...showPassword, current: !showPassword.current })}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-[#013220]/60 dark:text-foreground/60"
                  >
                    {showPassword.current ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPassword.new ? 'text' : 'password'}
                    placeholder="New Password"
                    value={passwords.new}
                    onChange={(e) => handlePasswordChange('new', e.target.value)}
                    className="w-full px-6 py-4 bg-white dark:bg-card rounded-[20px] border border-[#013220]/20 dark:border-border focus:outline-none text-[#013220] dark:text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword({ ...showPassword, new: !showPassword.new })}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-[#013220]/60 dark:text-foreground/60"
                  >
                    {showPassword.new ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPassword.confirm ? 'text' : 'password'}
                    placeholder="Confirm New Password"
                    value={passwords.confirm}
                    onChange={(e) => handlePasswordChange('confirm', e.target.value)}
                    className="w-full px-6 py-4 bg-white dark:bg-card rounded-[20px] border border-[#013220]/20 dark:border-border focus:outline-none text-[#013220] dark:text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-[#013220]/60 dark:text-foreground/60"
                  >
                    {showPassword.confirm ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                {/* Security Score Meter */}
                {passwords.new && (
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-[#013220]/70 dark:text-foreground/70">Password Strength</span>
                      <span className="text-sm font-semibold text-[#013220] dark:text-foreground">{getStrengthText()}</span>
                    </div>
                    <div className="w-full h-2 bg-[#F5F5DC] dark:bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${getStrengthColor()}`}
                        style={{ width: `${passwordStrength}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleSavePassword}
                    className="px-6 py-3 bg-[#013220] dark:bg-primary text-white dark:text-primary-foreground rounded-[20px] hover:bg-[#013220]/90 transition-colors"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => {
                      setShowPasswordFields(false);
                      setPasswords({ current: '', new: '', confirm: '' });
                      setPasswordStrength(0);
                    }}
                    className="px-6 py-3 bg-white dark:bg-secondary text-[#013220] dark:text-secondary-foreground rounded-[20px] border border-[#013220]/20 dark:border-border"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Preferences Section */}
          <div className="mb-8 bg-[#F5F5DC] dark:bg-card rounded-[32px] p-6 border border-[#013220]/5 dark:border-border">
            <div className="flex items-center gap-4 mb-6">
              <Moon className="text-[#013220] dark:text-foreground" size={24} />
              <h2 className="text-2xl text-[#013220] dark:text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>
                Preferences
              </h2>
            </div>

            <div className="flex items-center justify-between p-4 bg-white dark:bg-background rounded-[20px]">
              <div>
                <h4 className="font-semibold text-[#013220] dark:text-foreground mb-1">Dark Mode</h4>
                <p className="text-sm text-[#013220]/60 dark:text-foreground/60">Forest green background with light text</p>
              </div>
              <button
                onClick={toggleDarkMode}
                className={`relative w-14 h-8 rounded-full transition-colors ${
                  darkMode ? 'bg-[#50C878]' : 'bg-[#013220]/20 dark:bg-switch-background'
                }`}
              >
                <div
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
                    darkMode ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={async () => {
              await authService.logout();
              navigate('/auth');
            }}
            className="w-full py-4 bg-[#d4183d] text-white rounded-[24px] hover:bg-[#d4183d]/90 transition-colors flex items-center justify-center gap-2 font-semibold"
          >
            <LogOut size={20} />
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
