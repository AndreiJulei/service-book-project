import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Eye, EyeOff, MapPin } from 'lucide-react';
import { authService } from '../authService';

type AuthMode = 'client' | 'firm' | 'employee';
type FormMode = 'login' | 'signup';
type FirmMode = 'login' | 'signup';

export function AuthPage() {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<AuthMode>('client');
  const [formMode, setFormMode] = useState<FormMode>('login');
  const [firmMode, setFirmMode] = useState<FirmMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showMapPreview, setShowMapPreview] = useState(false);

  const [clientForm, setClientForm] = useState({
    email: '',
    password: '',
    username: '',
    phone: '',
    confirmPassword: '',
  });

  const [firmForm, setFirmForm] = useState({
    businessEmail: '',
    businessName: '',
    businessDescription: '',
    mapsUrl: '',
    password: '',
    confirmPassword: '',
  });

  const [employeeCode, setEmployeeCode] = useState(['', '', '', '', '', '']);
  const [employeeFormMode, setEmployeeFormMode] = useState<'login' | 'join'>('login');
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [verifiedFirmName, setVerifiedFirmName] = useState('');
  const [employeeLoginForm, setEmployeeLoginForm] = useState({
    usernameOrEmail: '',
    password: '',
  });
  const [employeeSignupForm, setEmployeeSignupForm] = useState({
    username: '',
    email: '',
    name: '',
    password: '',
    confirmPassword: '',
    color: '#013220',
  });

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formMode === 'login') {
      try {
        const response = await authService.login(clientForm.email, clientForm.password);
        const user = response.user;
        if (!user.roles?.includes('client')) {
          await authService.logout();
          alert('You do not have permission to access the Client Portal.');
          return;
        }
        navigate('/client/search');
      } catch (err: any) {
        alert(err.message || 'Invalid email or password');
      }
    } else {
      try {
        if (clientForm.password !== clientForm.confirmPassword) {
          alert('Passwords do not match');
          return;
        }
        await authService.register(clientForm.username, clientForm.email, clientForm.password, 'client');
        navigate('/client/search');
      } catch (err: any) {
        alert(err.message || 'Registration failed');
      }
    }
  };

  const handleFirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (firmMode === 'login') {
      try {
        const response = await authService.login(firmForm.businessEmail, firmForm.password);
        const user = response.user;
        if (!user.roles?.includes('admin')) {
          await authService.logout();
          alert('You do not have permission to access the Business Portal.');
          return;
        }
        navigate('/firm/dashboard');
      } catch (err: any) {
        alert(err.message || 'Invalid email or password');
      }
    } else {
      try {
        if (firmForm.password !== firmForm.confirmPassword) {
          alert('Passwords do not match');
          return;
        }
        await authService.register(firmForm.businessEmail, firmForm.businessName || firmForm.businessEmail, firmForm.password, 'admin');
        navigate('/firm/dashboard');
      } catch (err: any) {
        alert(err.message || 'Registration failed');
      }
    }
  };

  const handleEmployeeLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await authService.login(employeeLoginForm.usernameOrEmail, employeeLoginForm.password);
      const user = response.user;
      if (!user.roles?.includes('user')) {
        await authService.logout();
        alert('You do not have permission to access the Employee Schedule.');
        return;
      }
      navigate('/employee/schedule');
    } catch (err: any) {
      alert(err.message || 'Invalid email/username or password');
    }
  };

  const handleEmployeeCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = employeeCode.join('');
    if (code.length === 6) {
      try {
        const res = await fetch('/api/auth/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        });
        
        if (res.ok) {
          const resData = await res.json();
          setVerifiedFirmName(resData.firm_name);
          setIsCodeVerified(true);
        } else {
          const errData = await res.json();
          alert(errData.error || 'Invalid or expired access code');
        }
      } catch (err) {
        alert('Failed to verify access code with server.');
      }
    }
  };

  const handleEmployeeSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (employeeSignupForm.password !== employeeSignupForm.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    const code = employeeCode.join('');
    try {
      const res = await fetch('/api/auth/employee-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          username: employeeSignupForm.username,
          email: employeeSignupForm.email,
          password: employeeSignupForm.password,
          name: employeeSignupForm.name,
          color: employeeSignupForm.color
        })
      });
      if (res.ok) {
        await authService.login(employeeSignupForm.username, employeeSignupForm.password);
        navigate('/employee/schedule');
      } else {
        const errData = await res.json();
        alert(errData.error || 'Registration failed');
      }
    } catch (err) {
      alert('Failed to complete signup with server.');
    }
  };


  const handleCodeInput = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newCode = [...employeeCode];
      newCode[index] = value;
      setEmployeeCode(newCode);

      // Auto-focus next input
      if (value && index < 5) {
        const nextInput = document.getElementById(`code-${index + 1}`);
        nextInput?.focus();
      }
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Half - Forest Green with Image */}
      <div className="relative w-1/2 bg-[#013220] overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1754359667692-34308056cf0e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBzcGElMjBpbnRlcmlvciUyMG9yZ2FuaWN8ZW58MXx8fHwxNzc0NDUyMjQ4fDA&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Organic Spa"
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-[#013220] opacity-60"></div>
        </div>
        <div className="relative h-full flex items-center justify-center px-16">
          <div className="text-center">
            <h1 className="text-6xl mb-6 text-[#F5F5DC]" style={{ fontFamily: 'Playfair Display, serif' }}>
              ServiceBook
            </h1>
            <p className="text-2xl text-[#8FAF8A]" style={{ fontFamily: 'Playfair Display, serif' }}>
              Sustainable Sophistication.<br />Effortless Scheduling.
            </p>
          </div>
        </div>
      </div>

      {/* Right Half - Warm Cream with Auth Controls */}
      <div className="w-1/2 bg-[#F5F5DC] flex items-center justify-center px-16">
        <div className="w-full max-w-md">
          {/* Triple-State Toggle */}
          <div className="flex bg-white rounded-[32px] p-2 mb-12 shadow-md">
            <button
              onClick={() => setAuthMode('client')}
              className={`flex-1 py-4 rounded-[28px] transition-all duration-300 ${
                authMode === 'client'
                  ? 'bg-[#013220] text-white'
                  : 'text-[#013220] hover:bg-[#013220]/5'
              }`}
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Client Login
            </button>
            <button
              onClick={() => {
                setAuthMode('firm');
                setFormMode('login');
              }}
              className={`flex-1 py-4 rounded-[28px] transition-all duration-300 ${
                authMode === 'firm'
                  ? 'bg-[#013220] text-white'
                  : 'text-[#013220] hover:bg-[#013220]/5'
              }`}
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Firm Sign-In
            </button>
            <button
              onClick={() => setAuthMode('employee')}
              className={`flex-1 py-4 rounded-[28px] transition-all duration-300 ${
                authMode === 'employee'
                  ? 'bg-[#013220] text-white'
                  : 'text-[#013220] hover:bg-[#013220]/5'
              }`}
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Employee Join
            </button>
          </div>

          {/* Client Login/Signup */}
          {authMode === 'client' && (
            <div className="transition-all duration-500">
              <h2
                className="text-3xl mb-8 text-[#013220]"
                style={{ fontFamily: 'Playfair Display, serif' }}
              >
                {formMode === 'login' ? 'Welcome Back' : 'Create Account'}
              </h2>

              <form onSubmit={handleClientSubmit} className="space-y-6">
                {formMode === 'signup' && (
                  <div>
                    <input
                      type="text"
                      placeholder="Username"
                      value={clientForm.username}
                      onChange={(e) => setClientForm({ ...clientForm, username: e.target.value })}
                      className="w-full px-6 py-4 bg-white rounded-[24px] border border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220]"
                      style={{ fontFamily: 'Playfair Display, serif' }}
                      required
                    />
                  </div>
                )}

                <div>
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={clientForm.email}
                    onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                    className="w-full px-6 py-4 bg-white rounded-[24px] border border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220]"
                    style={{ fontFamily: 'Playfair Display, serif' }}
                    required
                  />
                </div>

                {formMode === 'signup' && (
                  <div>
                    <input
                      type="tel"
                      placeholder="Phone Number"
                      value={clientForm.phone}
                      onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                      className="w-full px-6 py-4 bg-white rounded-[24px] border border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220]"
                      style={{ fontFamily: 'Playfair Display, serif' }}
                      required
                    />
                  </div>
                )}

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={clientForm.password}
                    onChange={(e) => setClientForm({ ...clientForm, password: e.target.value })}
                    className="w-full px-6 py-4 bg-white rounded-[24px] border border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220]"
                    style={{ fontFamily: 'Playfair Display, serif' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-[#013220]/60"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                {formMode === 'signup' && (
                  <div>
                    <input
                      type="password"
                      placeholder="Confirm Password"
                      value={clientForm.confirmPassword}
                      onChange={(e) =>
                        setClientForm({ ...clientForm, confirmPassword: e.target.value })
                      }
                      className="w-full px-6 py-4 bg-white rounded-[24px] border border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220]"
                      style={{ fontFamily: 'Playfair Display, serif' }}
                      required
                    />
                  </div>
                )}

                {formMode === 'login' && (
                  <div className="text-right">
                    <button
                      type="button"
                      className="text-[#013220] hover:text-[#D4AF37] transition-colors"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-4 bg-[#013220] text-white rounded-[24px] hover:bg-[#013220]/90 transition-all duration-300 shadow-lg hover:shadow-xl"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {formMode === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  onClick={() => setFormMode(formMode === 'login' ? 'signup' : 'login')}
                  className="text-[#013220] hover:text-[#D4AF37] transition-colors"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {formMode === 'login'
                    ? 'New to Forest & Flow? Create an Account'
                    : 'Already have an account? Sign In'}
                </button>
              </div>
            </div>
          )}

          {/* Firm Sign-In */}
          {authMode === 'firm' && (
            <div className="transition-all duration-500">
              <h2
                className="text-3xl mb-8 text-[#013220]"
                style={{ fontFamily: 'Playfair Display, serif' }}
              >
                {firmMode === 'login' ? 'Business Portal' : 'Register Business'}
              </h2>

              <form onSubmit={handleFirmSubmit} className="space-y-6">
                <div>
                  <input
                    type="email"
                    placeholder="Business Email"
                    value={firmForm.businessEmail}
                    onChange={(e) => setFirmForm({ ...firmForm, businessEmail: e.target.value })}
                    className="w-full px-6 py-4 bg-white rounded-[24px] border border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220]"
                    style={{ fontFamily: 'Playfair Display, serif' }}
                    required
                  />
                </div>

                {firmMode === 'signup' && (
                  <>
                    <div>
                      <input
                        type="text"
                        placeholder="Business Name"
                        value={firmForm.businessName}
                        onChange={(e) => setFirmForm({ ...firmForm, businessName: e.target.value })}
                        className="w-full px-6 py-4 bg-white rounded-[24px] border border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220]"
                        style={{ fontFamily: 'Playfair Display, serif' }}
                        required
                      />
                    </div>

                    <div>
                      <textarea
                        placeholder="Business Description"
                        value={firmForm.businessDescription}
                        onChange={(e) =>
                          setFirmForm({ ...firmForm, businessDescription: e.target.value })
                        }
                        rows={4}
                        className="w-full px-6 py-4 bg-white rounded-[24px] border border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220] resize-none"
                        style={{ fontFamily: 'Playfair Display, serif' }}
                        required
                      />
                    </div>

                    <div>
                      <div className="relative">
                        <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-[#013220]/60" size={20} />
                        <input
                          type="url"
                          placeholder="Google Maps URL"
                          value={firmForm.mapsUrl}
                          onChange={(e) => {
                            setFirmForm({ ...firmForm, mapsUrl: e.target.value });
                            setShowMapPreview(e.target.value.length > 0);
                          }}
                          className="w-full pl-14 pr-6 py-4 bg-white rounded-[24px] border border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220]"
                          style={{ fontFamily: 'Playfair Display, serif' }}
                          required
                        />
                      </div>

                      {showMapPreview && firmForm.mapsUrl && (
                        <div className="mt-4 rounded-[24px] overflow-hidden shadow-lg">
                          <div className="bg-white p-4 text-center text-sm text-[#013220]/60">
                            Live Map Preview
                          </div>
                          <div className="h-48 bg-gradient-to-br from-[#8FAF8A] to-[#6B7F5F] flex items-center justify-center">
                            <MapPin size={48} className="text-white opacity-40" />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={firmForm.password}
                    onChange={(e) => setFirmForm({ ...firmForm, password: e.target.value })}
                    className="w-full px-6 py-4 bg-white rounded-[24px] border border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220]"
                    style={{ fontFamily: 'Playfair Display, serif' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-[#013220]/60"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                {firmMode === 'signup' && (
                  <div>
                    <input
                      type="password"
                      placeholder="Confirm Password"
                      value={firmForm.confirmPassword}
                      onChange={(e) =>
                        setFirmForm({ ...firmForm, confirmPassword: e.target.value })
                      }
                      className="w-full px-6 py-4 bg-white rounded-[24px] border border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220]"
                      style={{ fontFamily: 'Playfair Display, serif' }}
                      required
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-4 bg-[#013220] text-white rounded-[24px] hover:bg-[#013220]/90 transition-all duration-300 shadow-lg hover:shadow-xl"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {firmMode === 'login' ? 'Access Dashboard' : 'Create Business Account'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  onClick={() => setFirmMode(firmMode === 'login' ? 'signup' : 'login')}
                  className="text-[#013220] hover:text-[#D4AF37] transition-colors"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {firmMode === 'login'
                    ? 'New business? Register Here'
                    : 'Already registered? Sign In'}
                </button>
              </div>
            </div>
          )}

          {/* Employee Access */}
          {authMode === 'employee' && (
            <div className="transition-all duration-500">
              <h2
                className="text-3xl mb-4 text-center text-[#013220]"
                style={{ fontFamily: 'Playfair Display, serif' }}
              >
                Employee Access
              </h2>

              {/* Sub-tabs for Employee Mode */}
              <div className="flex bg-[#013220]/5 rounded-[24px] p-1 mb-8">
                <button
                  type="button"
                  onClick={() => {
                    setEmployeeFormMode('login');
                    setIsCodeVerified(false);
                  }}
                  className={`flex-1 py-2 rounded-[20px] text-sm transition-all duration-300 ${
                    employeeFormMode === 'login'
                      ? 'bg-[#013220] text-white shadow-sm'
                      : 'text-[#013220] hover:bg-[#013220]/5'
                  }`}
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setEmployeeFormMode('join')}
                  className={`flex-1 py-2 rounded-[20px] text-sm transition-all duration-300 ${
                    employeeFormMode === 'join'
                      ? 'bg-[#013220] text-white shadow-sm'
                      : 'text-[#013220] hover:bg-[#013220]/5'
                  }`}
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  Join Workspace
                </button>
              </div>

              {employeeFormMode === 'login' ? (
                /* Employee Login Form */
                <form onSubmit={handleEmployeeLoginSubmit} className="space-y-6">
                  <div>
                    <input
                      type="text"
                      placeholder="Username or Email"
                      value={employeeLoginForm.usernameOrEmail}
                      onChange={(e) => setEmployeeLoginForm({ ...employeeLoginForm, usernameOrEmail: e.target.value })}
                      className="w-full px-6 py-4 bg-white rounded-[24px] border border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220]"
                      style={{ fontFamily: 'Playfair Display, serif' }}
                      required
                    />
                  </div>

                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      value={employeeLoginForm.password}
                      onChange={(e) => setEmployeeLoginForm({ ...employeeLoginForm, password: e.target.value })}
                      className="w-full px-6 py-4 bg-white rounded-[24px] border border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220]"
                      style={{ fontFamily: 'Playfair Display, serif' }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-6 top-1/2 -translate-y-1/2 text-[#013220]/60"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-[#013220] text-white rounded-[24px] hover:bg-[#013220]/90 transition-all duration-300 shadow-lg hover:shadow-xl"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    Access Schedule
                  </button>
                </form>
              ) : (
                /* Employee Join Workspace (Code verification -> Onboarding) */
                <div>
                  {!isCodeVerified ? (
                    <div>
                      <p className="text-center mb-8 text-[#013220]/70" style={{ fontFamily: 'Inter, sans-serif' }}>
                        Enter 6-Digit Code
                      </p>

                      <form onSubmit={handleEmployeeCodeSubmit}>
                        <div className="flex justify-center gap-2 mb-8 flex-wrap">
                          {employeeCode.map((digit, index) => (
                            <input
                              key={index}
                              id={`code-${index}`}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={digit}
                              onChange={(e) => handleCodeInput(index, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Backspace' && !digit && index > 0) {
                                  const prevInput = document.getElementById(`code-${index - 1}`);
                                  prevInput?.focus();
                                }
                              }}
                              className="w-12 h-12 flex-shrink-0 text-center text-xl bg-white rounded-[12px] border-2 border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220]"
                              style={{ fontFamily: 'Inter, sans-serif' }}
                            />
                          ))}
                        </div>

                        <button
                          type="submit"
                          disabled={employeeCode.join('').length !== 6}
                          className="w-full py-4 bg-[#013220] text-white rounded-[24px] hover:bg-[#013220]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl"
                          style={{ fontFamily: 'Inter, sans-serif' }}
                        >
                          Verify Code
                        </button>
                      </form>

                      <div className="mt-8 text-center">
                        <p className="text-sm text-[#013220]/60" style={{ fontFamily: 'Inter, sans-serif' }}>
                          Contact your manager for access code
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Complete Profile Registration Form */
                    <div className="transition-all duration-500">
                      <p className="text-center font-semibold text-[#013220]/80 mb-6" style={{ fontFamily: 'Inter, sans-serif' }}>
                        Joining Workspace: <span className="text-[#D4AF37] font-bold">{verifiedFirmName}</span>
                      </p>

                      <form onSubmit={handleEmployeeSignupSubmit} className="space-y-4">
                        <div>
                          <input
                            type="text"
                            placeholder="Full Name (e.g. Jane Doe)"
                            value={employeeSignupForm.name}
                            onChange={(e) => setEmployeeSignupForm({ ...employeeSignupForm, name: e.target.value })}
                            className="w-full px-6 py-3 bg-white rounded-[20px] border border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220]"
                            style={{ fontFamily: 'Playfair Display, serif' }}
                            required
                          />
                        </div>

                        <div>
                          <input
                            type="email"
                            placeholder="Email Address"
                            value={employeeSignupForm.email}
                            onChange={(e) => setEmployeeSignupForm({ ...employeeSignupForm, email: e.target.value })}
                            className="w-full px-6 py-3 bg-white rounded-[20px] border border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220]"
                            style={{ fontFamily: 'Playfair Display, serif' }}
                            required
                          />
                        </div>

                        <div>
                          <input
                            type="text"
                            placeholder="Username"
                            value={employeeSignupForm.username}
                            onChange={(e) => setEmployeeSignupForm({ ...employeeSignupForm, username: e.target.value })}
                            className="w-full px-6 py-3 bg-white rounded-[20px] border border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220]"
                            style={{ fontFamily: 'Playfair Display, serif' }}
                            required
                          />
                        </div>

                        <div className="flex items-center justify-between p-3 bg-white rounded-[20px] border border-[#013220]/20">
                          <span className="text-sm font-semibold text-[#013220] opacity-80">Theme Color</span>
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={employeeSignupForm.color}
                              onChange={(e) => setEmployeeSignupForm({ ...employeeSignupForm, color: e.target.value })}
                              className="w-10 h-10 rounded-[10px] cursor-pointer border-none"
                            />
                            <span className="text-xs font-mono text-[#013220]">{employeeSignupForm.color}</span>
                          </div>
                        </div>

                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Password"
                            value={employeeSignupForm.password}
                            onChange={(e) => setEmployeeSignupForm({ ...employeeSignupForm, password: e.target.value })}
                            className="w-full px-6 py-3 bg-white rounded-[20px] border border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220]"
                            style={{ fontFamily: 'Playfair Display, serif' }}
                            required
                          />
                        </div>

                        <div>
                          <input
                            type="password"
                            placeholder="Confirm Password"
                            value={employeeSignupForm.confirmPassword}
                            onChange={(e) => setEmployeeSignupForm({ ...employeeSignupForm, confirmPassword: e.target.value })}
                            className="w-full px-6 py-3 bg-white rounded-[20px] border border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220]"
                            style={{ fontFamily: 'Playfair Display, serif' }}
                            required
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full py-4 bg-[#013220] text-white rounded-[24px] hover:bg-[#013220]/90 transition-all duration-300 shadow-lg hover:shadow-xl font-semibold"
                          style={{ fontFamily: 'Inter, sans-serif' }}
                        >
                          Complete Registration
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}