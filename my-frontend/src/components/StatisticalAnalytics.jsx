import { useEffect, useState, useRef } from "react";
import { useApi } from "../api/client";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';

const COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#6366f1'];

const ViewToggle = ({ mode, setMode, options }) => (
  <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
    {options.map((opt) => (
      <button
        key={opt.value}
        onClick={() => setMode(opt.value)}
        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
          mode === opt.value 
            ? 'bg-white text-slate-900 shadow-sm' 
            : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

const PeriodSelect = ({ value, onChange }) => (
  <select 
    value={value} 
    onChange={e => onChange(Number(e.target.value))}
    className="input input-sm w-auto text-xs ml-2"
  >
    <option value="30">30 days</option>
    <option value="60">60 days</option>
    <option value="90">90 days</option>
  </select>
);
export function TopCategoriesSales() {
  const api = useApi();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const [viewMode, setViewMode] = useState('bar');
  const mounted = useRef(true);

  useEffect(() => {
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [materials, categories, ledger] = await Promise.all([
          api.get("/api/materials"),
          api.get("/api/categories"),
          api.get("/api/stock-ledger?movement_type=issue")
        ]);

        if (!mounted.current) return;

        const cutoffDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);
        const recentIssues = ledger.filter(e => new Date(e.date_time) >= cutoffDate);

        const categoryStats = {};
        recentIssues.forEach(issue => {
          const material = materials.find(m => m.id === issue.material_id);
          if (material && material.category_id) {
            const catId = material.category_id;
            if (!categoryStats[catId]) {
              categoryStats[catId] = {
                categoryId: catId,
                totalQty: 0,
                totalValue: 0,
                itemCount: 0,
                uniqueItems: new Set()
              };
            }
            const qty = Math.abs(Number(issue.qty_change) || 0);
            const price = Number(issue.unit_price) || 0;
            
            categoryStats[catId].totalQty += qty;
            categoryStats[catId].totalValue += qty * price;
            categoryStats[catId].itemCount++;
            categoryStats[catId].uniqueItems.add(material.id);
          }
        });

        const result = Object.values(categoryStats)
          .map(stat => {
            const category = categories.find(c => c.id === stat.categoryId);
            return {
              categoryId: stat.categoryId,
              name: category?.name || `Category #${stat.categoryId}`,
              categoryName: category?.name || `Category #${stat.categoryId}`,
              totalQty: stat.totalQty,
              totalValue: stat.totalValue,
              transactionCount: stat.itemCount,
              uniqueItems: stat.uniqueItems.size
            };
          })
          .sort((a, b) => b.totalValue - a.totalValue)
          .slice(0, 10);

        setData(result);
      } catch (err) {
        console.error("Failed to load category stats", err);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const maxValue = Math.max(...data.map(d => d.totalValue), 1);

  if (loading) return <div className="text-center py-4 text-slate-500">Loading category statistics...</div>;

  return (
    <div className="card h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-lg font-semibold">📦 Top Categories</h3>
          <p className="text-sm text-slate-600">By sales volume</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle 
            mode={viewMode} 
            setMode={setViewMode} 
            options={[
              { value: 'bar', label: 'Bar' },
              { value: 'pie', label: 'Pie' },
              { value: 'list', label: 'List' }
            ]} 
          />
          <PeriodSelect value={period} onChange={setPeriod} />
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-slate-500 text-center py-8">No sales data available</p>
      ) : (
        <div className="flex-1">
          {viewMode === 'list' && (
            <>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="p-2 bg-sky-50 border border-sky-200 rounded text-center">
                  <div className="text-[10px] text-sky-600 uppercase">Categories</div>
                  <div className="text-lg font-bold text-sky-900">{data.length}</div>
                </div>
                <div className="p-2 bg-green-50 border border-green-200 rounded text-center">
                  <div className="text-[10px] text-green-600 uppercase">Txns</div>
                  <div className="text-lg font-bold text-green-900">
                    {data.reduce((sum, d) => sum + d.transactionCount, 0)}
                  </div>
                </div>
                <div className="p-2 bg-purple-50 border border-purple-200 rounded text-center">
                  <div className="text-[10px] text-purple-600 uppercase">Value</div>
                  <div className="text-lg font-bold text-purple-900">
                    {data.reduce((sum, d) => sum + d.totalValue, 0).toFixed(0)}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {data.map((cat, idx) => {
                  const percentage = (cat.totalValue / maxValue) * 100;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex-1">
                          <span className="font-medium text-slate-900">{cat.categoryName}</span>
                          <span className="text-xs text-slate-500 ml-2">({cat.transactionCount} txns)</span>
                        </div>
                        <span className="font-bold text-slate-900">{cat.totalValue.toFixed(0)}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-sky-500 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {viewMode === 'bar' && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#f1f5f9'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                  formatter={(value) => value.toFixed(2)}
                />
                <Bar dataKey="totalValue" fill="#0ea5e9" radius={[0, 4, 4, 0]} name="Sales" />
              </BarChart>
            </ResponsiveContainer>
          )}

          {viewMode === 'pie' && (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="totalValue"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => value.toFixed(2)} />
                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '12px'}} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}

// 2. Розподіл продажів по складах
export function WarehouseDistribution() {
  const api = useApi();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30); // Додано стейт періоду
  const [viewMode, setViewMode] = useState('pie');
  const mounted = useRef(true);

  useEffect(() => {
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [warehouses, ledger] = await Promise.all([
          api.get("/api/warehouses"),
          api.get("/api/stock-ledger?movement_type=issue")
        ]);

        if (!mounted.current) return;

        // Фільтруємо за вибраним періодом
        const cutoffDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);
        const recentIssues = ledger.filter(e => new Date(e.date_time) >= cutoffDate);

        const warehouseStats = {};
        recentIssues.forEach(issue => {
          const whId = issue.warehouse_id;
          if (whId) {
            if (!warehouseStats[whId]) {
              warehouseStats[whId] = { count: 0, totalQty: 0, totalValue: 0 };
            }
            warehouseStats[whId].count++;
            warehouseStats[whId].totalQty += Math.abs(Number(issue.qty_change) || 0);
            warehouseStats[whId].totalValue += Math.abs(Number(issue.total_price) || 0);
          }
        });

        const result = Object.entries(warehouseStats)
          .map(([whId, stats]) => {
            const warehouse = warehouses.find(w => w.id === parseInt(whId));
            return {
              warehouseId: parseInt(whId),
              warehouseName: warehouse?.name || `Warehouse #${whId}`,
              name: warehouse?.name || `WH #${whId}`,
              count: stats.count,
              totalQty: stats.totalQty,
              totalValue: stats.totalValue,
              value: stats.totalValue
            };
          })
          .sort((a, b) => b.totalValue - a.totalValue);

        setData(result);
      } catch (err) {
        console.error("Failed to load warehouse distribution", err);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]); // Додано залежність від period

  const total = data.reduce((sum, d) => sum + d.totalValue, 0);

  if (loading) return <div className="text-center py-4 text-slate-500">Loading warehouse stats...</div>;

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">🏢 Warehouses</h3>
          <p className="text-sm text-slate-600">Sales distribution</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle 
            mode={viewMode} 
            setMode={setViewMode} 
            options={[{ value: 'pie', label: 'Chart' }, { value: 'list', label: 'List' }]} 
          />
          <PeriodSelect value={period} onChange={setPeriod} />
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-slate-500 text-center py-8">No warehouse data available</p>
      ) : (
        <div className="flex-1">
          {viewMode === 'list' ? (
            <div className="space-y-4">
              {data.map((wh, idx) => {
                const percentage = total > 0 ? (wh.totalValue / total * 100) : 0;
                return (
                  <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold text-sm text-slate-900">{wh.warehouseName}</div>
                        <div className="text-xs text-slate-500">
                           {wh.count} txns • {wh.totalQty.toFixed(0)} items
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-900">{percentage.toFixed(1)}%</div>
                        <div className="text-xs text-slate-500">{wh.totalValue.toFixed(2)}</div>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-sky-600 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => val.toFixed(2)} />
                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '11px'}}/>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}

// 3. Статистика по постачальникам
export function SupplierStatistics() {
  const api = useApi();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(90); // Додано стейт періоду (default 90)
  const [viewMode, setViewMode] = useState('list');
  const mounted = useRef(true);

  useEffect(() => {
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [suppliers, receipts] = await Promise.all([
          api.get("/api/suppliers"),
          api.get("/api/receipts")
        ]);

        if (!mounted.current) return;

        // Фільтруємо за вибраним періодом
        const cutoffDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);
        const recentReceipts = receipts.filter(r => new Date(r.date) >= cutoffDate);

        const supplierStats = {};
        recentReceipts.forEach(receipt => {
          const suppId = receipt.supplier_id;
          if (suppId) {
            if (!supplierStats[suppId]) {
              supplierStats[suppId] = { 
                count: 0, 
                totalValue: 0,
                lastDelivery: null,
                avgValue: 0
              };
            }
            supplierStats[suppId].count++;
            supplierStats[suppId].totalValue += Number(receipt.total_amount) || 0;
            
            const receiptDate = new Date(receipt.date);
            if (!supplierStats[suppId].lastDelivery || receiptDate > supplierStats[suppId].lastDelivery) {
              supplierStats[suppId].lastDelivery = receiptDate;
            }
          }
        });

        const result = Object.entries(supplierStats)
          .map(([suppId, stats]) => {
            const supplier = suppliers.find(s => s.id === parseInt(suppId));
            return {
              supplierId: parseInt(suppId),
              supplierName: supplier?.name || `Supplier #${suppId}`,
              name: supplier?.name?.substring(0, 15) || `#${suppId}`,
              deliveryCount: stats.count,
              totalValue: stats.totalValue,
              avgValue: stats.count > 0 ? stats.totalValue / stats.count : 0,
              lastDelivery: stats.lastDelivery,
              daysSinceLastDelivery: stats.lastDelivery 
                ? Math.floor((Date.now() - stats.lastDelivery) / (1000 * 60 * 60 * 24))
                : null
            };
          })
          .sort((a, b) => b.totalValue - a.totalValue)
          .slice(0, 10);

        setData(result);
      } catch (err) {
        console.error("Failed to load supplier stats", err);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]); // Додано залежність від period

  if (loading) return <div className="text-center py-4 text-slate-500">Loading supplier statistics...</div>;

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">🚚 Top Suppliers</h3>
          <p className="text-sm text-slate-600">Supplies analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle 
            mode={viewMode} 
            setMode={setViewMode} 
            options={[{ value: 'chart', label: 'Chart' }, { value: 'list', label: 'Table' }]} 
          />
          <PeriodSelect value={period} onChange={setPeriod} />
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-slate-500 text-center py-8">No supplier data available</p>
      ) : (
        <div className="flex-1">
          {viewMode === 'list' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2 pr-2 font-medium">Supplier</th>
                    <th className="py-2 pr-2 text-right font-medium">Val</th>
                    <th className="py-2 pr-2 text-right font-medium">Last</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((supp, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 pr-2 font-medium truncate max-w-[120px]" title={supp.supplierName}>
                        {supp.supplierName}
                      </td>
                      <td className="py-2 pr-2 text-right font-bold text-slate-700">
                        {supp.totalValue.toFixed(0)}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <span className={`text-xs ${
                          supp.daysSinceLastDelivery <= 30 ? 'text-green-600' : 'text-slate-500'
                        }`}>
                          {supp.daysSinceLastDelivery !== null ? `${supp.daysSinceLastDelivery}d` : '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize: 10}} interval={0} angle={-45} textAnchor="end" height={60} />
                <YAxis tick={{fontSize: 11}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                  formatter={(value) => value.toFixed(2)}
                />
                <Bar dataKey="totalValue" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Value" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}

// 4. Найактивніші клієнти
export function TopCustomers() {
  const api = useApi();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(90); // Додано стейт періоду (default 90)
  const [viewMode, setViewMode] = useState('list');
  const mounted = useRef(true);

  useEffect(() => {
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [clients, issues] = await Promise.all([
          api.get("/api/clients"),
          api.get("/api/issues")
        ]);

        if (!mounted.current) return;

        // Фільтруємо за вибраним періодом
        const cutoffDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);
        const recentIssues = issues.filter(i => new Date(i.date) >= cutoffDate);

        const clientStats = {};
        recentIssues.forEach(issue => {
          const clientId = issue.client_id;
          if (clientId) {
            if (!clientStats[clientId]) {
              clientStats[clientId] = { 
                count: 0, 
                totalValue: 0,
                lastPurchase: null
              };
            }
            clientStats[clientId].count++;
            clientStats[clientId].totalValue += Number(issue.total_amount) || 0;
            
            const issueDate = new Date(issue.date);
            if (!clientStats[clientId].lastPurchase || issueDate > clientStats[clientId].lastPurchase) {
              clientStats[clientId].lastPurchase = issueDate;
            }
          }
        });

        const result = Object.entries(clientStats)
          .map(([clientId, stats]) => {
            const client = clients.find(c => c.id === parseInt(clientId));
            return {
              clientId: parseInt(clientId),
              clientName: client?.name || `Client #${clientId}`,
              name: client?.name?.substring(0, 15) || `#${clientId}`,
              orderCount: stats.count,
              totalValue: stats.totalValue,
              avgOrder: stats.count > 0 ? stats.totalValue / stats.count : 0,
              lastPurchase: stats.lastPurchase,
              daysSinceLastPurchase: stats.lastPurchase 
                ? Math.floor((Date.now() - stats.lastPurchase) / (1000 * 60 * 60 * 24))
                : null
            };
          })
          .sort((a, b) => b.totalValue - a.totalValue)
          .slice(0, 10);

        setData(result);
      } catch (err) {
        console.error("Failed to load customer stats", err);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]); // Додано залежність від period

  const totalRevenue = data.reduce((sum, d) => sum + d.totalValue, 0);

  if (loading) return <div className="text-center py-4 text-slate-500">Loading customer statistics...</div>;

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">⭐ Top Customers</h3>
          <p className="text-sm text-slate-600">Revenue</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle 
            mode={viewMode} 
            setMode={setViewMode} 
            options={[{ value: 'chart', label: 'Chart' }, { value: 'list', label: 'List' }]} 
          />
          <PeriodSelect value={period} onChange={setPeriod} />
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-slate-500 text-center py-8">No customer data available</p>
      ) : (
        <div className="flex-1">
          {viewMode === 'list' ? (
            <>
              <div className="mb-4 p-3 bg-linear-to-r from-sky-50 to-purple-50 border border-sky-200 rounded-lg">
                <div className="text-xs text-slate-600">Total Revenue (Top 10)</div>
                <div className="text-2xl font-bold text-slate-900">{totalRevenue.toFixed(0)}</div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {data.reduce((sum, d) => sum + d.orderCount, 0)} orders total
                </div>
              </div>

              <div className="space-y-3">
                {data.map((client, idx) => {
                  const share = totalRevenue > 0 ? (client.totalValue / totalRevenue * 100) : 0;
                  return (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">
                            {idx + 1}
                          </div>
                          <div className="overflow-hidden">
                            <div className="font-medium text-sm text-slate-900 truncate max-w-[120px]">{client.clientName}</div>
                            <div className="text-[10px] text-slate-500">
                              {client.orderCount} ord • Avg: {client.avgOrder.toFixed(0)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-sm text-slate-900">{client.totalValue.toFixed(0)}</div>
                          <div className="text-[10px] text-slate-500">{share.toFixed(1)}%</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>Last purchase:</span>
                        <span className={
                          client.daysSinceLastPurchase <= 7 ? 'text-green-600 font-medium' :
                          client.daysSinceLastPurchase <= 30 ? 'text-slate-600' :
                          'text-amber-600'
                        }>
                          {client.daysSinceLastPurchase !== null 
                            ? `${client.daysSinceLastPurchase}d ago`
                            : 'N/A'
                          }
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={90} tick={{fontSize: 11}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                  formatter={(value) => value.toFixed(2)}
                />
                <Bar dataKey="totalValue" fill="#ec4899" radius={[0, 4, 4, 0]} barSize={20} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}

export default {
  TopCategoriesSales,
  WarehouseDistribution,
  SupplierStatistics,
  TopCustomers
};