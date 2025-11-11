import { useEffect, useState } from "react";
import { useApi } from "../api/client";

function StatCard({ title, value, subtitle, icon, color = "sky" }) {
  const colorClasses = {
    sky: "bg-sky-50 text-sky-700 border-sky-200",
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-slate-900 mb-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        {icon && (
          <div className={`p-3 rounded-lg border ${colorClasses[color]}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

function SimpleBarChart({ data, dataKey, label }) {
  if (!data || data.length === 0) return <p className="text-slate-500">No data</p>;
  
  const maxValue = Math.max(...data.map(d => d[dataKey] || 0));
  
  return (
    <div className="space-y-2">
      {data.map((item, idx) => {
        const value = item[dataKey] || 0;
        const percentage = maxValue > 0 ? (value / maxValue * 100) : 0;
        
        return (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-700 truncate flex-1">{item.name || item.code}</span>
              <span className="font-medium text-slate-900 ml-2">{value.toFixed(2)}</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-sky-600 rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimelineChart({ data }) {
  const [tooltip, setTooltip] = useState(null); 

  if (!data || data.length === 0) return <p className="text-slate-500">No data</p>;
  
  const maxReceipts = Math.max(...data.map(d => d.receipts_count || 0));
  const maxIssues = Math.max(...data.map(d => d.issues_count || 0));
  const maxValue = Math.max(1, maxReceipts, maxIssues);
  
  const handleMouseMove = (e) => {
    if (tooltip) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltip(t => ({ 
        ...t, 
        x: e.clientX - rect.left, 
        y: e.clientY - rect.top 
      }));
    }
  };

  const handleDayEnter = (item) => {
    setTooltip({
      x: 0, y: 0,
      date: item.date,
      receipts: item.receipts_count,
      issues: item.issues_count
    });
  };

  return (
    <div 
      className="relative flex items-end gap-6 min-w-max h-32 px-2"
      onMouseLeave={() => setTooltip(null)} 
      onMouseMove={handleMouseMove} 
    >
      {data.slice(-30).map((item, idx) => {
        const receiptsHeight = (item.receipts_count / maxValue * 100);
        const issuesHeight = (item.issues_count / maxValue * 100);
        
        return (
          <div 
            key={idx} 
            className="flex flex-col items-center gap-1 w-10"
            onMouseEnter={() => handleDayEnter(item)} 
          >
            <div className="flex items-end h-24 w-full gap-0.5">
              <div 
                className="w-1/2 bg-green-500 rounded-t transition-all"
                style={{ height: `${receiptsHeight}%` }}
              />
              <div 
                className="w-1/2 bg-rose-500 rounded-t transition-all"
                style={{ height: `${issuesHeight}%` }}
              />
            </div>
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {new Date(item.date).toLocaleDateString('uk', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        );
      })}

      {/*Tooltip*/}
      {tooltip && (
        <div 
          className="absolute bg-slate-900 text-white p-2 rounded-lg shadow-lg text-sm z-10"
          style={{ 
            transform: `translate(${tooltip.x + 10}px, ${tooltip.y - 80}px)`, 
            pointerEvents: 'none',
            whiteSpace: 'nowrap'
          }}
        >
          <p className="font-bold mb-1">
            {new Date(tooltip.date).toLocaleDateString('uk', { 
              day: 'numeric', month: 'long', year: 'numeric' 
            })}
          </p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
            <span>Receipts: {tooltip.receipts}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-rose-500 rounded-sm"></div>
            <span>Issues: {tooltip.issues}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const api = useApi();
  const [loading, setLoading] = useState(true);
  
  const [summary, setSummary] = useState(null);
  const [topMaterials, setTopMaterials] = useState([]);
  const [warehouseStats, setWarehouseStats] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [sum, top, wh, time, low, act] = await Promise.all([
          api.get("/api/dashboard/summary"),
          api.get("/api/dashboard/top-materials?limit=5"),
          api.get("/api/dashboard/warehouse-stats"),
          api.get("/api/dashboard/receipts-issues-timeline?days=30"),
          api.get("/api/dashboard/low-stock-alert?limit=10"),
          api.get("/api/dashboard/recent-activities?limit=8"),
        ]);
        
        setSummary(sum);
        setTopMaterials(top);
        setWarehouseStats(wh);
        setTimeline(time);
        setLowStock(low);
        setActivities(act);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mb-4"></div>
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">📊 Dashboard</h1>
        <p className="text-slate-600 mt-1">Overview of your warehouse operations</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Warehouses"
          value={summary?.warehouses || 0}
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
          color="sky"
        />
        <StatCard
          title="Active Materials"
          value={summary?.materials || 0}
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
          color="purple"
        />
        <StatCard
          title="Stock Value"
          value={`${(summary?.total_stock_value || 0).toFixed(0)} ₴`}
          subtitle="UAH only"
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          color="green"
        />
        <StatCard
          title="Low Stock Items"
          value={summary?.low_stock_items || 0}
          subtitle="Below minimum"
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
          color="amber"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Materials */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">🔥 Top Materials (30 days)</h3>
          <SimpleBarChart data={topMaterials} dataKey="total_issued" />
        </div>

        {/* Warehouse Stats */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">📦 Warehouse Utilization</h3>
          <SimpleBarChart 
            data={warehouseStats.map(w => ({ name: w.warehouse_name, value: w.available }))} 
            dataKey="value" 
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">📈 Activity Timeline (14 days)</h3>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-slate-600">Receipts</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-rose-500 rounded"></div>
              <span className="text-slate-600">Issues</span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <TimelineChart data={timeline} />
        </div>
      </div>

      {/* Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alert */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 text-amber-700">⚠️ Low Stock Alert</h3>
          {lowStock.length === 0 ? (
            <p className="text-slate-500 text-center py-8">All stock levels are healthy! 🎉</p>
          ) : (
            <div className="space-y-2">
              {lowStock.slice(0, 10).map((item, idx) => (
                <div key={idx} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {item.code} — {item.name}
                      </p>
                      <p className="text-xs text-slate-600">
                        @ {item.warehouse_name}
                      </p>
                    </div>
                    <div className="text-right ml-2">
                      <p className="text-sm font-medium text-amber-700">
                        {item.available.toFixed(2)} / {item.min_stock.toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.fill_rate.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activities */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">🕐 Recent Activities</h3>
          <div className="space-y-2">
            {activities.map((act, idx) => (
              <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        act.type === 'receipt' ? 'bg-green-100 text-green-700' :
                        act.type === 'issue' ? 'bg-rose-100 text-rose-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {act.type}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(act.timestamp).toLocaleString('uk', { 
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 truncate">{act.material}</p>
                    <p className="text-xs text-slate-500">
                      {act.warehouse} • {act.reference}
                    </p>
                  </div>
                  <div className="text-right ml-2">
                    <p className={`text-sm font-medium ${
                      act.qty_change > 0 ? 'text-green-600' : 'text-rose-600'
                    }`}>
                      {act.qty_change > 0 ? '+' : ''}{act.qty_change}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}