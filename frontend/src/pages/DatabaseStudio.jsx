import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Database, Table, ArrowLeft, RefreshCw, LayoutGrid, Terminal, Plus, Trash2, X, Download, Upload } from 'lucide-react';
import { ThemeToggle } from '../contexts/ThemeContext';
import { Logo } from '../components/Logo';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';

const DatabaseStudio = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableData, setTableData] = useState({ columns: [], rows: [], primary_keys: [] });
  const [loadingTables, setLoadingTables] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState(null);
  
  const [activeTab, setActiveTab] = useState('tables'); // tables | sql
  const [sqlQuery, setSqlQuery] = useState('');
  const [sqlResults, setSqlResults] = useState(null);
  const [executingSql, setExecutingSql] = useState(false);

  // Modals state
  const [showCreateTableModal, setShowCreateTableModal] = useState(false);
  const [newTableForm, setNewTableForm] = useState({ name: '', columns: [{ name: 'id', type: 'serial', isPk: true }] });
  const [showInsertRowModal, setShowInsertRowModal] = useState(false);
  const [newRowData, setNewRowData] = useState({});
  const [showMigrateModal, setShowMigrateModal] = useState(false);
  const [migrateUri, setMigrateUri] = useState('');
  const [migrating, setMigrating] = useState(false);

  const { showToast } = useToast();
  const showConfirm = useConfirm();

  useEffect(() => {
    fetchTables();
  }, [id]);

  const fetchTables = async () => {
    setLoadingTables(true);
    setError(null);
    try {
      const token = localStorage.getItem('sso_token');
      const res = await fetch(`/nidhi-api/instances/${id}/studio/tables/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTables(data.tables || []);
    } catch (err) {
      setError("Failed to fetch tables: " + err.message);
    } finally {
      setLoadingTables(false);
    }
  };

  const fetchTableData = async (tableName) => {
    setSelectedTable(tableName);
    setLoadingData(true);
    setError(null);
    try {
      const token = localStorage.getItem('sso_token');
      const res = await fetch(`/nidhi-api/instances/${id}/studio/tables/${tableName}/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTableData({ columns: data.columns || [], rows: data.rows || [], primary_keys: data.primary_keys || [] });
    } catch (err) {
      setError("Failed to fetch table data: " + err.message);
      setTableData({ columns: [], rows: [], primary_keys: [] });
    } finally {
      setLoadingData(false);
    }
  };

  const executeRawQuery = async (queryStr) => {
    const token = localStorage.getItem('sso_token');
    const res = await fetch(`/nidhi-api/instances/${id}/studio/query/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ query: queryStr })
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Query failed");
    }
    return await res.json();
  };

  const handleExecuteSql = async () => {
    if (!sqlQuery.trim()) return;
    setExecutingSql(true);
    setError(null);
    setSqlResults(null);
    try {
      const data = await executeRawQuery(sqlQuery);
      setSqlResults(data);
      if (data.message === "Query executed successfully." && sqlQuery.toLowerCase().includes('create table')) {
        fetchTables(); // Refresh sidebar if a table was created
      }
    } catch (err) {
      setError("SQL Error: " + err.message);
    } finally {
      setExecutingSql(false);
    }
  };

  const handleCreateTable = async (e) => {
    e.preventDefault();
    if (!newTableForm.name.trim()) return;
    
    try {
      const cols = newTableForm.columns.map(c => `"${c.name}" ${c.type} ${c.isPk ? 'PRIMARY KEY' : ''}`).join(', ');
      const query = `CREATE TABLE "${newTableForm.name}" (${cols});`;
      await executeRawQuery(query);
      setShowCreateTableModal(false);
      setNewTableForm({ name: '', columns: [{ name: 'id', type: 'serial', isPk: true }] });
      fetchTables();
      showToast('Table created successfully', 'success');
    } catch (err) {
      showToast("Failed to create table: " + err.message, 'error');
    }
  };

  const handleInsertRow = async (e) => {
    e.preventDefault();
    try {
      const cols = Object.keys(newRowData).map(c => `"${c}"`).join(', ');
      const vals = Object.values(newRowData).map(v => v === '' ? 'NULL' : `'${v.replace(/'/g, "''")}'`).join(', ');
      const query = `INSERT INTO "${selectedTable}" (${cols}) VALUES (${vals});`;
      await executeRawQuery(query);
      setShowInsertRowModal(false);
      setNewRowData({});
      fetchTableData(selectedTable);
      showToast('Row inserted successfully', 'success');
    } catch (err) {
      showToast("Failed to insert row: " + err.message, 'error');
    }
  };

  const handleDeleteRow = async (row) => {
    if (!tableData.primary_keys || tableData.primary_keys.length === 0) {
      showToast("Cannot delete row visually: No primary key found for this table. Use SQL Editor.", 'warning');
      return;
    }
    const pk = tableData.primary_keys[0]; // simplify to first PK
    const val = row[pk];
    const ok = await showConfirm(`Delete row where ${pk} = ${val}?`);
    if (!ok) return;
    
    try {
      const query = `DELETE FROM "${selectedTable}" WHERE "${pk}" = '${String(val).replace(/'/g, "''")}';`;
      await executeRawQuery(query);
      fetchTableData(selectedTable);
    } catch (err) {
      showToast("Failed to delete row: " + err.message, 'error');
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const token = localStorage.getItem('sso_token');
      const res = await fetch(`/nidhi-api/instances/${id}/studio/download/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Download failed');
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Get filename from Content-Disposition if possible, or fallback
      const contentDisposition = res.headers.get('Content-Disposition');
      let filename = 'backup.sql';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      showToast("Failed to download backup: " + err.message, 'error');
    }
  };

  const handleMigrateData = async (e) => {
    e.preventDefault();
    if (!migrateUri) return;
    setMigrating(true);
    try {
      const token = localStorage.getItem('sso_token');
      const res = await fetch(`/nidhi-api/instances/${id}/studio/migrate/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ source_uri: migrateUri })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Migration trigger failed");
      }
      showToast("Migration task started! It will run in the background.", 'success');
      setShowMigrateModal(false);
      setMigrateUri('');
    } catch (err) {
      showToast("Migration Error: " + err.message, 'error');
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <header className="flex-none h-16 border-b border-slate-300 dark:border-slate-800 flex items-center justify-between px-6 bg-white dark:bg-slate-900 z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <Logo className="scale-75 origin-left" />
          <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-2"></div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Database className="w-4 h-4 text-[#98FF98]" />
            Data Studio
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleDownloadBackup}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
          >
            <Download className="w-4 h-4" /> Download Backup
          </button>
          <button 
            onClick={() => setShowMigrateModal(true)}
            className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800"
          >
            <Upload className="w-4 h-4" /> Migrate Data
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 flex-none border-r border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col">
          <div className="p-4 border-b border-slate-300 dark:border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tables</span>
              <button onClick={fetchTables} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                <RefreshCw className={`w-3.5 h-3.5 ${loadingTables ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <button 
              onClick={() => setShowCreateTableModal(true)}
              className="w-full flex items-center justify-center gap-2 bg-[#98FF98]/10 text-[#22c55e] dark:text-[#98FF98] border border-[#98FF98]/20 hover:bg-[#98FF98]/20 px-3 py-1.5 rounded-md text-sm font-medium transition"
            >
              <Plus className="w-4 h-4" /> New Table
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingTables ? (
              <div className="p-4 text-sm text-slate-500 text-center">Loading tables...</div>
            ) : tables.length === 0 ? (
              <div className="p-4 text-sm text-slate-500 text-center">No tables found.</div>
            ) : (
              tables.map(t => (
                <button
                  key={t}
                  onClick={() => fetchTableData(t)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                    selectedTable === t 
                      ? 'bg-[#98FF98]/20 text-[#22c55e] dark:text-[#98FF98]' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <Table className="w-4 h-4" />
                  <span className="truncate">{t}</span>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0B1120] relative">
          {error && (
            <div className="absolute top-4 left-4 right-4 z-20 bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm flex items-center gap-2 shadow-lg backdrop-blur-md">
              <span className="font-semibold">Error:</span> {error}
            </div>
          )}

          {/* Top Tabs inside Main */}
          <div className="flex-none flex items-center gap-2 px-4 pt-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120]">
            <button
              onClick={() => setActiveTab('tables')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'tables' ? 'border-[#98FF98] text-[#22c55e] dark:text-[#98FF98]' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Data Explorer
            </button>
            <button
              onClick={() => setActiveTab('sql')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'sql' ? 'border-[#98FF98] text-[#22c55e] dark:text-[#98FF98]' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <Terminal className="w-4 h-4" /> SQL Editor
            </button>
          </div>

          {activeTab === 'tables' ? (
            !selectedTable ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <LayoutGrid className="w-16 h-16 mb-4 opacity-20" />
                <p>Select a table from the sidebar to view data</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-none p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                  <div className="flex items-center gap-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Table className="w-5 h-5 text-slate-400" />
                      {selectedTable}
                    </h2>
                    <div className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                      {tableData.rows.length} rows
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      // Init empty form based on columns
                      const initialData = {};
                      tableData.columns.forEach(c => initialData[c] = '');
                      setNewRowData(initialData);
                      setShowInsertRowModal(true);
                    }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition"
                  >
                    <Plus className="w-4 h-4" /> Insert Row
                  </button>
                </div>
                
                <div className="flex-1 overflow-auto bg-slate-50 dark:bg-[#0B1120]">
                  {loadingData ? (
                    <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-3">
                      <RefreshCw className="w-6 h-6 animate-spin text-[#98FF98]" />
                      Fetching records...
                    </div>
                  ) : tableData.columns.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">Table is empty or has no columns.</div>
                  ) : (
                    <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300 border-collapse">
                      <thead className="text-xs uppercase bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 sticky top-0 z-10 shadow-sm backdrop-blur-md">
                        <tr>
                          {tableData.columns.map(col => (
                            <th key={col} className="px-4 py-3 font-semibold whitespace-nowrap border-b border-slate-200 dark:border-slate-700">
                              <span className="flex items-center gap-1">
                                {col}
                                {tableData.primary_keys?.includes(col) && <span title="Primary Key" className="text-yellow-500 text-[10px]">PK</span>}
                              </span>
                            </th>
                          ))}
                          <th className="px-4 py-3 font-semibold whitespace-nowrap border-b border-slate-200 dark:border-slate-700 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.rows.map((row, i) => (
                          <tr key={i} className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                            {tableData.columns.map(col => (
                              <td key={col} className="px-4 py-3 whitespace-nowrap overflow-hidden text-ellipsis max-w-xs">
                                {row[col] !== null ? String(row[col]) : <span className="text-slate-400 italic">null</span>}
                              </td>
                            ))}
                            <td className="px-4 py-2 text-right">
                              <button 
                                onClick={() => handleDeleteRow(row)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition opacity-0 group-hover:opacity-100"
                                title="Delete Row"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )
          ) : (
            <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950 p-4 gap-4">
              <div className="flex-none bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-sm">
                <div className="p-2 border-b border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-2">Query Editor</span>
                  <button 
                    onClick={handleExecuteSql}
                    disabled={executingSql || !sqlQuery.trim()}
                    className="px-4 py-1.5 bg-[#4ade80] hover:bg-[#22c55e] disabled:opacity-50 text-slate-900 text-sm font-semibold rounded-md transition flex items-center gap-2"
                  >
                    {executingSql ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
                    Execute
                  </button>
                </div>
                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  className="w-full h-48 p-4 bg-transparent text-slate-800 dark:text-slate-200 font-mono text-sm resize-y focus:outline-none placeholder-slate-400 dark:placeholder-slate-600"
                  placeholder="SELECT * FROM table_name; OR CREATE TABLE test (id INT);"
                  spellCheck={false}
                />
              </div>

              <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-sm">
                <div className="p-3 border-b border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Results</span>
                </div>
                <div className="flex-1 overflow-auto bg-slate-50 dark:bg-[#0B1120] p-4">
                  {sqlResults ? (
                    <div>
                      {sqlResults.message && (
                        <div className="text-sm text-[#22c55e] dark:text-[#98FF98] mb-4 font-medium flex items-center gap-2">
                          ✓ {sqlResults.message}
                        </div>
                      )}
                      
                      {sqlResults.columns && sqlResults.columns.length > 0 ? (
                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300 border-collapse">
                            <thead className="text-xs uppercase bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 sticky top-0 z-10 shadow-sm backdrop-blur-md">
                              <tr>
                                {sqlResults.columns.map(col => (
                                  <th key={col} className="px-4 py-3 font-semibold whitespace-nowrap border-b border-slate-200 dark:border-slate-700">
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sqlResults.rows.map((row, i) => (
                                <tr key={i} className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                  {sqlResults.columns.map(col => (
                                    <td key={col} className="px-4 py-3 whitespace-nowrap overflow-hidden text-ellipsis max-w-xs">
                                      {row[col] !== null ? String(row[col]) : <span className="text-slate-400 italic">null</span>}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-slate-500 text-sm italic">No data returned by query.</div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">
                      Run a query to see results here.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Create Table Modal */}
      {showCreateTableModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-xl w-full max-w-lg shadow-2xl relative">
            <h2 className="text-xl font-bold mb-4 text-indigo-600 dark:text-[#98FF98] flex items-center gap-2">
              <Table className="w-6 h-6" /> Create New Table
            </h2>
            <form onSubmit={handleCreateTable} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Table Name</label>
                <input 
                  required
                  type="text" 
                  value={newTableForm.name}
                  onChange={(e) => setNewTableForm({...newTableForm, name: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  placeholder="e.g., users"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Columns</label>
                  <button type="button" onClick={() => setNewTableForm({
                    ...newTableForm, 
                    columns: [...newTableForm.columns, { name: '', type: 'text', isPk: false }]
                  })} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                    + Add Column
                  </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {newTableForm.columns.map((col, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input 
                        required
                        type="text" 
                        value={col.name}
                        onChange={(e) => {
                          const newCols = [...newTableForm.columns];
                          newCols[idx].name = e.target.value;
                          setNewTableForm({...newTableForm, columns: newCols});
                        }}
                        className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white outline-none"
                        placeholder="Column name"
                      />
                      <select 
                        value={col.type}
                        onChange={(e) => {
                          const newCols = [...newTableForm.columns];
                          newCols[idx].type = e.target.value;
                          setNewTableForm({...newTableForm, columns: newCols});
                        }}
                        className="w-32 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-900 dark:text-white outline-none"
                      >
                        <option value="serial">serial</option>
                        <option value="integer">integer</option>
                        <option value="text">text</option>
                        <option value="boolean">boolean</option>
                        <option value="timestamp">timestamp</option>
                        <option value="jsonb">jsonb</option>
                      </select>
                      <label className="flex items-center gap-1 text-xs text-slate-500">
                        <input 
                          type="checkbox" 
                          checked={col.isPk}
                          onChange={(e) => {
                            const newCols = [...newTableForm.columns];
                            newCols[idx].isPk = e.target.checked;
                            setNewTableForm({...newTableForm, columns: newCols});
                          }}
                        />
                        PK
                      </label>
                      <button type="button" onClick={() => {
                        const newCols = newTableForm.columns.filter((_, i) => i !== idx);
                        setNewTableForm({...newTableForm, columns: newCols});
                      }} className="p-1 text-slate-400 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowCreateTableModal(false)} className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition">Create Table</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Insert Row Modal */}
      {showInsertRowModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-xl w-full max-w-lg shadow-2xl relative">
            <h2 className="text-xl font-bold mb-4 text-indigo-600 dark:text-[#98FF98] flex items-center gap-2">
              <Plus className="w-6 h-6" /> Insert Row into {selectedTable}
            </h2>
            <form onSubmit={handleInsertRow} className="space-y-4">
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {tableData.columns.map(col => (
                  <div key={col}>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {col} {tableData.primary_keys?.includes(col) && <span className="text-yellow-500 text-xs">(PK)</span>}
                    </label>
                    <input 
                      type="text" 
                      value={newRowData[col] || ''}
                      onChange={(e) => setNewRowData({...newRowData, [col]: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      placeholder={tableData.primary_keys?.includes(col) ? "Leave empty for auto-increment" : "Value"}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowInsertRowModal(false)} className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition">Insert Row</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Migrate Data Modal */}
      {showMigrateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-xl w-full max-w-lg shadow-2xl relative">
            <h2 className="text-xl font-bold mb-4 text-indigo-600 dark:text-[#98FF98] flex items-center gap-2">
              <Upload className="w-6 h-6" /> Migrate Data from External Database
            </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Enter the connection URI of the source database (e.g. <span className="font-mono">postgres://user:password@host:port/dbname</span>). Nidhi will connect, dump the data, and restore it into this instance. External migration currently supports PostgreSQL sources.
              </p>
              <form onSubmit={handleMigrateData} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Source Database URI</label>
                  <input 
                    required
                    type="text" 
                    value={migrateUri}
                    onChange={(e) => setMigrateUri(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-mono text-sm"
                    placeholder="postgres://user:password@host:port/dbname"
                  />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowMigrateModal(false)} className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition font-medium">Cancel</button>
                <button type="submit" disabled={migrating} className="flex-1 flex justify-center items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg transition">
                  {migrating ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                  {migrating ? 'Starting...' : 'Start Migration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
};

export default DatabaseStudio;
