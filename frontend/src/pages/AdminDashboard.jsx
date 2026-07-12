import React, { useState, useEffect } from 'react';
import { Database, Server, Copy, ShieldAlert, Zap, Plus, Package, User, Settings, CreditCard, ChevronDown, LogOut, HardDrive, ExternalLink } from 'lucide-react';
import { Logo } from '../components/Logo';
import { ThemeToggle } from '../contexts/ThemeContext';
import { NotificationBell } from '../components/NotificationBell';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('instances');
  const [servers, setServers] = useState([]);
  const [products, setProducts] = useState([]);
  const [instances, setInstances] = useState([]);
  const [buckets, setBuckets] = useState([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const showConfirm = useConfirm();

  // Forms state
  const [newProduct, setNewProduct] = useState({ name: '', description: '' });
  const [newServer, setNewServer] = useState({ name: '', host: '', engine: 'postgresql', port: '5432', root_user: 'postgres', root_password: '', environment_type: 'prod' });

  useEffect(() => {
    fetchServers();
    fetchInstances();
    fetchProducts();
    fetchBuckets();
  }, []);

  const getHeaders = () => {
    const token = localStorage.getItem('sso_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const fetchServers = async () => {
    try {
      const res = await fetch(`/nidhi-api/servers/`, { headers: getHeaders() });
      if (res.ok) setServers(await res.json());
      else if (res.status === 401 || res.status === 403) navigate('/login');
    } catch (e) { console.error(e); }
  };

  const fetchInstances = async () => {
    try {
      const res = await fetch(`/nidhi-api/instances/`, { headers: getHeaders() });
      if (res.ok) setInstances(await res.json());
      else if (res.status === 401 || res.status === 403) navigate('/login');
    } catch (e) { console.error(e); }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`/nidhi-api/products/`, { headers: getHeaders() });
      if (res.ok) setProducts(await res.json());
      else if (res.status === 401 || res.status === 403) navigate('/login');
    } catch (e) { console.error(e); }
  };

  const fetchBuckets = async () => {
    try {
      const res = await fetch(`/nidhi-api/buckets/`, { headers: getHeaders() });
      if (res.ok) setBuckets(await res.json());
      else if (res.status === 401 || res.status === 403) navigate('/login');
    } catch (e) { console.error(e); }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/nidhi-api/products/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newProduct)
      });
      if (res.ok) {
        showToast("Product created!", 'success');
        setNewProduct({ name: '', description: '' });
        fetchProducts();
      } else {
        showToast("Failed to create product.", 'error');
      }
    } catch (e) { console.error(e); }
  };

  const handleCreateServer = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...newServer, port: parseInt(newServer.port) || (newServer.engine === 'cassandra' ? 9042 : 5432) };
      const res = await fetch(`/nidhi-api/servers/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast("Server added!", 'success');
        setNewServer({ name: '', host: '', engine: 'postgresql', port: '5432', root_user: 'postgres', root_password: '', environment_type: 'prod' });
        fetchServers();
      } else {
        showToast("Failed to add server.", 'error');
      }
    } catch (e) { console.error(e); }
  };

  const forceReplication = async (id) => {
    const devServer = servers.find(s => s.environment_type === 'dev');
    if (!devServer) { showToast("No dev server found for replication.", 'error'); return; }
    const ok = await showConfirm("Force replication to Dev? This will clone Prod data over.");
    if (!ok) return;
    try {
      await fetch(`/nidhi-api/instances/${id}/replicate/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ dev_server_id: devServer.id, new_db_name: `repl_${Date.now()}` })
      });
      showToast("Replication task queued in background.", 'success');
      fetchInstances();
    } catch (e) {
      showToast("Replication failed.", 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-8 transition-colors duration-300">
      <header className="mb-10 flex justify-between items-center border-b border-slate-300 dark:border-slate-800 pb-6">
        <div className="flex items-center gap-6">
          <Logo />
          <div className="h-10 w-px bg-slate-300 dark:bg-slate-700"></div>
          <div>
            <h1 className="text-3xl font-bold text-red-500 flex items-center gap-3">
              <ShieldAlert /> GOD MODE
            </h1>
            <p className="text-slate-500 dark:text-slate-400">Global Cluster Overview & Administrative Actions</p>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <NotificationBell />
          <ThemeToggle />
          
          <button 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg font-medium transition"
          >
            User Dashboard
          </button>
          
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
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{localStorage.getItem('user_role')?.replace('_', ' ') || 'Admin'}</p>
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

      {/* Tabs */}
      <div className="flex gap-4 mb-8">
        <button 
          onClick={() => setActiveTab('instances')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'instances' ? 'bg-slate-800 text-white dark:bg-slate-700' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'}`}
        >
          <Database className="inline w-4 h-4 mr-2" /> Instances
        </button>
        <button 
          onClick={() => setActiveTab('servers')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'servers' ? 'bg-slate-800 text-white dark:bg-slate-700' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'}`}
        >
          <Server className="inline w-4 h-4 mr-2" /> Servers Config
        </button>
        <button 
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'products' ? 'bg-slate-800 text-white dark:bg-slate-700' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'}`}
        >
          <Package className="inline w-4 h-4 mr-2" /> Products Config
        </button>
        <button 
          onClick={() => setActiveTab('buckets')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'buckets' ? 'bg-slate-800 text-white dark:bg-slate-700' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'}`}
        >
          <HardDrive className="inline w-4 h-4 mr-2" /> Storage Buckets
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {activeTab === 'instances' && (
          <div className="lg:col-span-4">
            <h2 className="text-xl font-semibold mb-4 text-slate-700 dark:text-slate-300">All Database Instances</h2>
            <div className="bg-white dark:bg-slate-800/40 backdrop-blur-md border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden shadow-xl">
              <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                   <tr>
                     <th className="px-6 py-4">Database</th>
                     <th className="px-6 py-4">Node</th>
                     <th className="px-6 py-4">Engine</th>
                     <th className="px-6 py-4">Status</th>
                     <th className="px-6 py-4">Created By</th>
                     <th className="px-6 py-4">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                   {instances.map(db => (
                     <tr key={db.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition">
                       <td className="px-6 py-4 font-semibold">{db.db_name}</td>
                       <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{db.server_name}</td>
                       <td className="px-6 py-4">
                         <span className="px-2 py-1 text-xs rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 uppercase">{db.engine}</span>
                       </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full border ${db.status === 'available' ? 'bg-[#4ade80]/20 text-emerald-600 dark:text-[#98FF98] border-[#4ade80]/40' : 'bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/20'}`}>
                          {db.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm">{db.created_by_sso_id}</td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => forceReplication(db.id)}
                          className="px-3 py-1 bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-500/20 rounded hover:bg-blue-200 dark:hover:bg-blue-500/20 text-xs flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" /> Replicate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'servers' && (
          <>
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-300 dark:border-slate-700 shadow-xl">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Plus className="w-4 h-4"/> Add Server</h3>
                <form onSubmit={handleCreateServer} className="space-y-4">
                  <div><label className="text-xs text-slate-500 dark:text-slate-400">Name</label><input required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-2 rounded" value={newServer.name} onChange={e => setNewServer({...newServer, name: e.target.value})} placeholder="Prod DB 1"/></div>
                  <div><label className="text-xs text-slate-500 dark:text-slate-400">Host</label><input required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-2 rounded" value={newServer.host} onChange={e => setNewServer({...newServer, host: e.target.value})} placeholder="10.0.0.5"/></div>
                  <div><label className="text-xs text-slate-500 dark:text-slate-400">Engine</label>
                    <select className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-2 rounded" value={newServer.engine} onChange={e => setNewServer({...newServer, engine: e.target.value, port: e.target.value === 'cassandra' ? '9042' : '5432', root_user: e.target.value === 'cassandra' ? 'cassandra' : 'postgres'})}>
                      <option value="postgresql">PostgreSQL</option>
                      <option value="cassandra">Cassandra</option>
                    </select>
                  </div>
                  <div><label className="text-xs text-slate-500 dark:text-slate-400">Port</label><input required type="number" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-2 rounded" value={newServer.port} onChange={e => setNewServer({...newServer, port: e.target.value})}/></div>
                  <div><label className="text-xs text-slate-500 dark:text-slate-400">Root User</label><input required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-2 rounded" value={newServer.root_user} onChange={e => setNewServer({...newServer, root_user: e.target.value})}/></div>
                  <div><label className="text-xs text-slate-500 dark:text-slate-400">Root Password</label><input required type="password" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-2 rounded" value={newServer.root_password} onChange={e => setNewServer({...newServer, root_password: e.target.value})}/></div>
                  <div><label className="text-xs text-slate-500 dark:text-slate-400">Environment</label>
                    <select className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-2 rounded" value={newServer.environment_type} onChange={e => setNewServer({...newServer, environment_type: e.target.value})}>
                      <option value="prod">Production</option><option value="dev">Development</option>
                    </select>
                  </div>
                  <button type="submit" className="w-full bg-slate-800 dark:bg-slate-700 text-white p-2 rounded hover:bg-slate-700 dark:hover:bg-slate-600 transition">Save Server</button>
                </form>
              </div>
            </div>
            <div className="lg:col-span-3">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {servers.map(server => (
                  <div key={server.id} className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-4 rounded-xl shadow">
                    <div className="flex items-center gap-3 mb-2">
                      <Server className={`w-5 h-5 ${server.environment_type === 'prod' ? 'text-red-500' : 'text-emerald-500 dark:text-[#98FF98]'}`} />
                      <span className="font-semibold text-lg">{server.name}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{server.host}:{server.port}</p>
                    <div className="flex gap-2">
                      <span className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-700 rounded uppercase">{server.environment_type}</span>
                      <span className="px-2 py-1 text-xs bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 rounded uppercase">{server.engine}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'products' && (
          <>
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-300 dark:border-slate-700 shadow-xl">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Plus className="w-4 h-4"/> Add Product</h3>
                <form onSubmit={handleCreateProduct} className="space-y-4">
                  <div><label className="text-xs text-slate-500 dark:text-slate-400">Name</label><input required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-2 rounded" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="Cool Startup App"/></div>
                  <div><label className="text-xs text-slate-500 dark:text-slate-400">Description</label><textarea className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-2 rounded" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} rows="3"></textarea></div>
                  <button type="submit" className="w-full bg-slate-800 dark:bg-slate-700 text-white p-2 rounded hover:bg-slate-700 dark:hover:bg-slate-600 transition">Save Product</button>
                </form>
              </div>
            </div>
            <div className="lg:col-span-3">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {products.map(product => (
                  <div key={product.id} className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-4 rounded-xl shadow">
                    <div className="flex items-center gap-3 mb-2">
                      <Package className="w-5 h-5 text-indigo-500" />
                      <span className="font-semibold text-lg">{product.name}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{product.description || "No description"}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'buckets' && (
          <div className="lg:col-span-4">
            <h2 className="text-xl font-semibold mb-4 text-slate-700 dark:text-slate-300">Storage Buckets</h2>
            <div className="bg-white dark:bg-slate-800/40 backdrop-blur-md border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden shadow-xl">
              <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Bucket Name</th>
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4">Location</th>
                    <th className="px-6 py-4">Endpoint</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Created</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                  {buckets.map(bucket => (
                    <tr key={bucket.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition">
                      <td className="px-6 py-4 font-semibold">{bucket.bucket_name}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{bucket.product__name}</td>
                      <td className="px-6 py-4">
                        {bucket.server__name ? (
                          <span className="text-sm">
                            <span className={`px-2 py-1 text-xs rounded border ${bucket.server__environment_type === 'prod' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'}`}>
                              {bucket.server__environment_type.toUpperCase()}
                            </span>
                            <span className="ml-2 text-slate-500 dark:text-slate-400">{bucket.server__host}</span>
                          </span>
                        ) : (
                          <span className="text-sm text-slate-500 dark:text-slate-400">Local Dev Server</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm">{bucket.endpoint}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full border ${bucket.status === 'available' ? 'bg-[#4ade80]/20 text-emerald-600 dark:text-[#98FF98] border-[#4ade80]/40' : 'bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/20'}`}>
                          {bucket.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm">{new Date(bucket.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => navigate(`/bucket-studio/${bucket.id}`)}
                          className="px-3 py-1 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-500/20 rounded hover:bg-indigo-200 dark:hover:bg-indigo-500/20 text-xs flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Explore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;
