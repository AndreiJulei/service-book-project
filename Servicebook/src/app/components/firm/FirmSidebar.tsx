import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import {
  Calendar,
  BarChart3,
  MessageSquare,
  Settings,
  AlertTriangle,
  Users
} from 'lucide-react';
import { authStore } from './authStore';

export function FirmSidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    authStore.getCurrentUser().then(user => {
      if (!user) {
        navigate('/auth');
      } else if (!user.roles?.includes('admin')) {
        alert('Access Denied: You do not have permission to view the Business Portal.');
        navigate('/auth');
      }
    }).catch(() => {
      navigate('/auth');
    });
  }, [navigate]);

  const getButtonClass = (path: string) => {
    const isActive = location.pathname.startsWith(path);
    return `p-4 rounded-[16px] transition-colors ${
      isActive ? 'bg-[#013220] text-white' : 'text-[#013220] hover:bg-white'
    }`;
  };

  const handleLogout = async () => {
    await authStore.logout();
    navigate('/');
  };

  return (
    <div className="w-20 bg-[#F5F5DC] flex flex-col items-center py-8 gap-8 border-r border-[#013220]/10 flex-shrink-0 h-full overflow-y-auto">
      <button
        onClick={() => navigate('/firm/dashboard')}
        className={getButtonClass('/firm/dashboard')}
        title="Master Schedule"
      >
        <Calendar size={24} />
      </button>
      <button
        onClick={() => navigate('/firm/analytics')}
        className={getButtonClass('/firm/analytics')}
        title="Analytics"
      >
        <BarChart3 size={24} />
      </button>
      <button
        onClick={() => navigate('/firm/employees')}
        className={getButtonClass('/firm/employees')}
        title="Employees"
      >
        <Users size={24} />
      </button>
      <button
        onClick={() => navigate('/firm/chats')}
        className={getButtonClass('/firm/chats')}
        title="Chats"
      >
        <MessageSquare size={24} />
      </button>
      <button
        onClick={() => navigate('/firm/settings')}
        className={getButtonClass('/firm/settings')}
        title="Settings"
      >
        <Settings size={24} />
      </button>
      <div className="mt-auto flex flex-col gap-8 w-full items-center">
        <button
          onClick={() => navigate('/firm/admin')}
          className={getButtonClass('/firm/admin')}
          title="Admin Dashboard"
        >
          <AlertTriangle size={24} />
        </button>
        <button
          onClick={handleLogout}
          className="p-4 rounded-[16px] text-[#d4183d] hover:bg-[#d4183d]/10 transition-colors"
          title="Logout"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
