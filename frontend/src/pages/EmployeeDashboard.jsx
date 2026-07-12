import React, { useState, useEffect } from 'react';
import { Database, Plus, RefreshCw, X, Key, Trash2, LogOut, User, Settings, CreditCard, ChevronDown } from 'lucide-react';
import { Logo } from '../components/Logo';
import { ThemeToggle } from '../contexts/ThemeContext';
import { NotificationBell } from '../components/NotificationBell';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { useNavigate } from 'react-router-dom';

const EmployeeDashboard = () => {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [showBucketModal, setShowBucketModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const showConfirm = useConfirm();
  const [servers, setServers] = useState([]);
  const [products, setProducts] = useState([]);
  const [buckets, setBuckets] = useState([]);
  const [activeTab, setActiveTab] = useState('databases'); // databases | buckets
  const [newDbForm, setNewDbForm] = useState({ db_name: '', server_id: '', product_id: '' });
  const [newBucketForm, setNewBucketForm] = useState({ bucket_name: '', product_id: '', server_id: '' });
  const [credentialsModal, setCredentialsModal] = useState(null);
  const [bucketCredentialsModal, setBucketCredentialsModal] = useState(null);
  const [openKebabMenu, setOpenKebabMenu] = useState(null); // stores instance id or bucket id

  useEffect(() => {
    fetchInstances();
    fetchBuckets();
    fetchServers();
  }, []);

  const fetchInstances = async () => {
    try {
      const token = localStorage.getItem('sso_token');
      const response = await fetch(`/nidhi-api/instances/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 401 || response.status === 403) { navigate('/login'); return; }
      const data = await response.json();
      setInstances(Array.isArray(data) ? data : []);
      
      const prodRes = await fetch(`/nidhi-api/products/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (prodRes.status === 401 || prodRes.status === 403) { navigate('/login'); return; }
      const prodData = await prodRes.json();
      setProducts(Array.isArray(prodData) ? prodData : []);

      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch data", error);
      setLoading(false);
    }
  };

  const fetchBuckets = async () => {
    try {
      const token = localStorage.getItem('sso_token');
      const res = await fetch(`/nidhi-api/buckets/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) { navigate('/login'); return; }
      if (res.ok) {
        setBuckets(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch buckets:", error);
    }
  };

  const fetchServers = async () => {
    try {
      const token = localStorage.getItem('sso_token');
      const servRes = await fetch(`/nidhi-api/servers/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (servRes.status === 401 || servRes.status === 403) { navigate('/login'); return; }
      const servData = await servRes.json();
      setServers(Array.isArray(servData) ? servData : []);
    } catch (error) {
      console.error("Failed to fetch servers", error);
    }
  };

  const handleProvision = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('sso_token');
      const response = await fetch(`/nidhi-api/instances/`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          db_name: newDbForm.db_name,
          server_id: newDbForm.server_id,
          product_id: newDbForm.product_id
        })
      });
      
      if (response.ok) {
        setShowProvisionModal(false);
        setNewDbForm({ db_name: '', server_id: '', product_id: '' });
        fetchInstances();
        showToast('Database provisioning started', 'success');
      } else {
        const errorData = await response.json();
        showToast("Failed: " + JSON.stringify(errorData), 'error');
      }
    } catch (error) {
      showToast("Error provisioning database", 'error');
    }
  };

  const handleViewBucketCredentials = async (id) => {
    try {
      const token = localStorage.getItem('sso_token');
      const res = await fetch(`/nidhi-api/buckets/${id}/reveal/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBucketCredentialsModal(data);
      } else {
        const errorData = await res.json();
        showToast("Failed to fetch bucket credentials: " + JSON.stringify(errorData), 'error');
      }
    } catch (error) {
      showToast("Error fetching credentials", 'error');
    }
  };

  const requestSoftDelete = async (id) => {
    const ok = await showConfirm("Are you sure you want to request soft-delete? This will revoke access immediately.");
    if (!ok) return;
    try {
      const token = localStorage.getItem('sso_token');
      await fetch(`/nidhi-api/instances/${id}/delete/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchInstances();
    } catch (err) {
      showToast("Soft delete failed", 'error');
    }
  };

  const handleProvisionBucket = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('sso_token');
      const res = await fetch(`/nidhi-api/buckets/provision/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newBucketForm)
      });
      
      if (res.ok) {
        setShowBucketModal(false);
        setNewBucketForm({ bucket_name: '', product_id: '', server_id: '' });
        fetchBuckets();
        showToast('Bucket provisioning started', 'success');
      } else {
        const errorData = await res.json();
        showToast("Failed to provision bucket: " + JSON.stringify(errorData), 'error');
      }
    } catch (error) {
      showToast("Error provisioning bucket", 'error');
    }
  };

  const handleViewCredentials = async (id) => {
    try {
      const token = localStorage.getItem('sso_token');
      const res = await fetch(`/nidhi-api/instances/${id}/reveal/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCredentialsModal(data);
      } else {
        const errorData = await res.json();
        showToast("Failed to fetch credentials: " + JSON.stringify(errorData), 'error');
      }
    } catch (err) {
      showToast("Error fetching credentials", 'error');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">Loading Workspace...</div>;
  }

  const isAdmin = localStorage.getItem('user_role') === 'founding_engineer';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-8 transition-colors duration-300">
      <header className="mb-10 flex justify-between items-center border-b border-slate-300 dark:border-slate-800 pb-6">
        <div className="flex items-center gap-6">
          <Logo />
          <div className="h-10 w-px bg-slate-300 dark:bg-slate-700"></div>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400">
                  My Workspace
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Manage databases and storage for your assigned products.</p>
              </div>
            </div>
            
            <div className="flex gap-4 border-b border-slate-300 dark:border-slate-700">
              <button 
                onClick={() => setActiveTab('databases')}
                className={`pb-3 px-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'databases' ? 'border-[#98FF98] text-[#22c55e] dark:text-[#98FF98]' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                Databases
              </button>
              <button 
                onClick={() => setActiveTab('buckets')}
                className={`pb-3 px-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'buckets' ? 'border-[#98FF98] text-[#22c55e] dark:text-[#98FF98]' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                Storage Buckets
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <NotificationBell />
          <ThemeToggle />
          {isAdmin && (
            <button 
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg font-medium transition"
            >
              Admin Panel
            </button>
          )}
          <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
            <button 
              onClick={() => setShowProvisionModal(true)}
              className="flex items-center gap-2 bg-[#4ade80] hover:bg-[#22c55e] text-slate-900 px-4 py-1.5 rounded-md font-medium transition text-sm"
            >
              <Plus className="w-4 h-4" /> New Database
            </button>
            <button 
              onClick={() => setShowBucketModal(true)}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-1.5 rounded-md font-medium transition text-sm ml-1"
            >
              <Plus className="w-4 h-4" /> New Bucket
            </button>
          </div>
          <div className="relative">
            <button 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg font-medium transition"
            >
              <User className="w-5 h-5" /> Profile <ChevronDown className="w-4 h-4" />
            </button>
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
                <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{localStorage.getItem('sso_username') || 'Aadi Sheshu'}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{localStorage.getItem('user_role')?.replace('_', ' ') || 'Employee'}</p>
                </div>
                <div className="p-2 space-y-1">
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition">
                    <Settings className="w-4 h-4" /> Account Settings
                  </button>
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition">
                    <CreditCard className="w-4 h-4" /> Billing & Usage
                  </button>
                </div>
                <div className="p-2 border-t border-slate-200 dark:border-slate-700">
                  <button 
                    onClick={() => {
                      localStorage.removeItem('sso_token');
                      localStorage.removeItem('user_role');
                      localStorage.removeItem('sso_username');
                      navigate('/login');
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition"
                  >
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {showProvisionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 p-8 rounded-xl w-full max-w-md shadow-2xl relative">
            <h2 className="text-xl font-bold mb-6 text-[#98FF98]">Provision New Database</h2>
            <form onSubmit={handleProvision} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Database Name</label>
                <input 
                  required
                  type="text" 
                  value={newDbForm.db_name}
                  onChange={(e) => setNewDbForm({...newDbForm, db_name: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white"
                  placeholder="e.g., hr-prod-db"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Select Product</label>
                <select 
                  required
                  value={newDbForm.product_id}
                  onChange={(e) => setNewDbForm({...newDbForm, product_id: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white"
                >
                  <option value="">-- Choose Product --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Target Server</label>
                <select 
                  required
                  value={newDbForm.server_id}
                  onChange={(e) => setNewDbForm({...newDbForm, server_id: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white"
                >
                  <option value="">-- Choose Server --</option>
                  {servers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.environment_type})</option>)}
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowProvisionModal(false)} className="flex-1 px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-[#98FF98] text-slate-900 font-bold rounded hover:bg-[#86e086] transition">Provision</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBucketModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 rounded-xl w-full max-w-md shadow-2xl relative">
            <h2 className="text-xl font-bold mb-6 text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
              <Database className="w-6 h-6" /> Provision New Bucket
            </h2>
            <form onSubmit={handleProvisionBucket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Bucket Name</label>
                <input 
                  required
                  type="text" 
                  value={newBucketForm.bucket_name}
                  onChange={(e) => setNewBucketForm({...newBucketForm, bucket_name: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  placeholder="e.g., media-bucket"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Select Product</label>
                <select 
                  required
                  value={newBucketForm.product_id}
                  onChange={(e) => setNewBucketForm({...newBucketForm, product_id: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                >
                  <option value="">-- Choose Product --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target Server (Optional)</label>
                <select 
                  value={newBucketForm.server_id}
                  onChange={(e) => setNewBucketForm({...newBucketForm, server_id: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                >
                  <option value="">-- Auto (Local MinIO) --</option>
                  {servers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.environment_type})</option>)}
                </select>
                <p className="text-xs text-slate-500 mt-1">If omitted, uses cluster default MinIO.</p>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowBucketModal(false)} className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition">Provision</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {credentialsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 p-8 rounded-xl w-full max-w-lg shadow-2xl relative">
            <button onClick={() => setCredentialsModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-[#98FF98]">
              <Key className="w-6 h-6" /> Database Credentials
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Connection String</label>
                <div className="flex gap-2">
                  <input readOnly value={credentialsModal.connection_string} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-300 font-mono text-sm" />
                  <button onClick={() => navigator.clipboard.writeText(credentialsModal.connection_string)} className="px-3 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition text-sm">Copy</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Host</label>
                  <input readOnly value={credentialsModal.host} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-300 font-mono text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Port</label>
                  <input readOnly value={credentialsModal.port} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-300 font-mono text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Database Name</label>
                  <input readOnly value={credentialsModal.db_name} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-300 font-mono text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">User</label>
                  <input readOnly value={credentialsModal.db_user} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-300 font-mono text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Password</label>
                <div className="flex gap-2">
                  <input readOnly value={credentialsModal.db_password} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-300 font-mono text-sm" />
                  <button onClick={() => navigator.clipboard.writeText(credentialsModal.db_password)} className="px-3 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition text-sm">Copy</button>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <button onClick={() => setCredentialsModal(null)} className="w-full py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition flex items-center justify-center gap-2">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {bucketCredentialsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 p-8 rounded-xl w-full max-w-lg shadow-2xl relative">
            <button onClick={() => setBucketCredentialsModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-[#98FF98]">
              <Key className="w-6 h-6" /> S3 Bucket Credentials
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Bucket Name</label>
                <div className="flex gap-2">
                  <input readOnly value={bucketCredentialsModal.bucket_name} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-300 font-mono text-sm" />
                  <button onClick={() => navigator.clipboard.writeText(bucketCredentialsModal.bucket_name)} className="px-3 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition text-sm">Copy</button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Endpoint</label>
                <input readOnly value={bucketCredentialsModal.endpoint} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-300 font-mono text-sm" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Access Key</label>
                <div className="flex gap-2">
                  <input readOnly value={bucketCredentialsModal.access_key} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-300 font-mono text-sm" />
                  <button onClick={() => navigator.clipboard.writeText(bucketCredentialsModal.access_key)} className="px-3 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition text-sm">Copy</button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Secret Key</label>
                <div className="flex gap-2">
                  <input readOnly value={bucketCredentialsModal.secret_key} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-300 font-mono text-sm" />
                  <button onClick={() => navigator.clipboard.writeText(bucketCredentialsModal.secret_key)} className="px-3 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition text-sm">Copy</button>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <button onClick={() => setBucketCredentialsModal(null)} className="w-full py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition flex items-center justify-center gap-2">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'databases' && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {instances.length === 0 ? (
          <div className="col-span-full text-center text-slate-500 py-12">No databases provisioned yet.</div>
        ) : (
          instances.map(db => (
            <div key={db.id} className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 shadow-xl relative overflow-hidden group">
              <div className={`absolute top-0 right-0 w-32 h-32 bg-[#98FF98] mix-blend-overlay filter blur-[64px] opacity-10 group-hover:opacity-20 transition-opacity duration-500`}></div>
              
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-slate-900/80 rounded-lg text-[#98FF98]">
                    <Database className="w-6 h-6" />
                  </div>
                   <div>
                     <h3 className="font-semibold text-lg">{db.db_name}</h3>
                     <span className="text-xs text-slate-400 bg-slate-900/50 px-2 py-1 rounded-full">{db.product_name || 'Nidhi Service'}</span>
                     <span className="ml-1 text-xs text-indigo-300 bg-indigo-500/20 px-2 py-1 rounded-full uppercase">{db.engine}</span>
                   </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full border ${
                  db.status === 'available' ? 'bg-[#98FF98]/10 text-[#98FF98] border-[#98FF98]/20' : 
                  db.status === 'provisioning' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                  'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  {db.status.toUpperCase()}
                </span>
              </div>
              
              <div className="space-y-2 text-sm text-slate-400 mb-6 relative z-10">
                <p>Node: <span className="text-slate-200">{db.server_name}</span></p>
                <p>User: <span className="text-slate-200 font-mono">{db.db_user}</span></p>
              </div>

              <div className="flex items-center gap-2 relative z-10">
                <button 
                  onClick={() => navigate(`/studio/${db.id}`)}
                  disabled={db.status !== 'available'}
                  className="flex-1 px-3 py-2.5 bg-[#98FF98]/10 text-[#98FF98] rounded-lg border border-[#98FF98]/20 hover:bg-[#98FF98]/20 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 whitespace-nowrap font-medium"
                >
                  {db.status === 'provisioning' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  {db.status === 'provisioning' ? 'Provisioning...' : 'Open Studio'}
                </button>
                <div className="relative">
                  <button 
                    onClick={() => setOpenKebabMenu(openKebabMenu === db.id ? null : db.id)}
                    className="p-2.5 bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-600/50 transition flex-none"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                  </button>
                  {openKebabMenu === db.id && (
                    <div className="absolute right-0 bottom-full mb-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
                      <button onClick={() => { handleViewCredentials(db.id); setOpenKebabMenu(null); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition font-medium">
                        <Key className="w-4 h-4" /> Credentials
                      </button>
                      <button 
                        onClick={() => { requestSoftDelete(db.id); setOpenKebabMenu(null); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition font-medium border-t border-slate-200 dark:border-slate-700"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      )}

      {activeTab === 'buckets' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {buckets.length === 0 ? (
              <div className="col-span-full text-center text-slate-500 py-12">No buckets provisioned yet.</div>
            ) : buckets.map(bucket => (
              <div key={bucket.id} className="group relative bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">{bucket.product__name || 'Nidhi Service'}</h3>
                    <p className="text-[#22c55e] dark:text-[#98FF98] font-medium text-sm mt-1">{bucket.bucket_name}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    bucket.status === 'available' ? 'bg-[#98FF98]/20 text-[#22c55e] dark:text-[#98FF98]' :
                    bucket.status === 'provisioning' ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' :
                    'bg-red-500/20 text-red-600 dark:text-red-400'
                  }`}>
                    {bucket.status.toUpperCase()}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400 mb-6 relative z-10">
                  <p>Endpoint: <span className="text-slate-200 font-mono">{bucket.endpoint}</span></p>
                </div>

                <div className="flex items-center gap-2 relative z-10">
                  <button 
                    onClick={() => handleViewBucketCredentials(bucket.id)} 
                    disabled={bucket.status !== 'available'}
                    className="flex-1 px-3 py-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20 disabled:opacity-50 transition flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    {bucket.status === 'provisioning' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                    {bucket.status === 'provisioning' ? 'Provisioning...' : 'Credentials'}
                  </button>
                  <button 
                    onClick={() => navigate(`/bucket-studio/${bucket.id}`)}
                    disabled={bucket.status !== 'available'}
                    className="flex-1 px-3 py-2.5 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium rounded-lg hover:bg-purple-100 dark:hover:bg-purple-500/20 disabled:opacity-50 transition flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    Explore
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;
