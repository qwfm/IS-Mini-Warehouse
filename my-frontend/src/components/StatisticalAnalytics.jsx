// src/components/StatisticalAnalytics.jsx
import { useEffect, useState, useRef } from "react";
import { useApi } from "../api/client";

// 1. Найпопулярніші категорії за продажами
export function TopCategoriesSales() {
  const api = useApi();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
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

        // Фільтруємо за період
        const cutoffDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);
        const recentIssues = ledger.filter(e => new Date(e.date_time) >= cutoffDate);

        // Групуємо по категоріях
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

        // Форматуємо результат
        const result = Object.values(categoryStats)
          .map(stat => {
            const category = categories.find(c => c.id === stat.categoryId);
            return {
              categoryId: stat.categoryId,
              categoryName: category?.name || `Category #${stat.categoryId}`,
              totalQty: stat.totalQty,
              totalValue: stat.totalValue,
              transactionCount: stat.itemCount,
              uniqueItems: stat.uniqueItems.size
            };
          })
          .sort((a, b) => b.totalValue - a.totalValue);

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
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">📦 Top Categories by Sales</h3>
          <p className="text-sm text-slate-600">Most sold product categories</p>
        </div>
        <select 
          value={period} 
          onChange={e => setPeriod(Number(e.target.value))}
          className="input input-sm"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {data.length === 0 ? (
        <p className="text-slate-500 text-center py-8">No sales data available</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-center">
              <div className="text-xs text-sky-600">Total Categories</div>
              <div className="text-2xl font-bold text-sky-900">{data.length}</div>
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
              <div className="text-xs text-green-600">Total Transactions</div>
              <div className="text-2xl font-bold text-green-900">
                {data.reduce((sum, d) => sum + d.transactionCount, 0)}
              </div>
            </div>
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-center">
              <div className="text-xs text-purple-600">Total Value</div>
              <div className="text-2xl font-bold text-purple-900">
                {data.reduce((sum, d) => sum + d.totalValue, 0).toFixed(0)}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {data.map((cat, idx) => {
              const percentage = (cat.totalValue / maxValue) * 100;
              return (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">{cat.categoryName}</div>
                      <div className="text-xs text-slate-500">
                        {cat.transactionCount} transactions • {cat.uniqueItems} unique items
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="font-bold text-slate-900">{cat.totalValue.toFixed(2)}</div>
                      <div className="text-xs text-slate-500">{cat.totalQty.toFixed(0)} pcs</div>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-linear-to-r from-sky-500 to-purple-500 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// 2. Розподіл продажів по складах
export function WarehouseDistribution() {
  const api = useApi();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
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

        // Останні 30 днів
        const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
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
              count: stats.count,
              totalQty: stats.totalQty,
              totalValue: stats.totalValue
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
  }, []);

  const total = data.reduce((sum, d) => sum + d.totalValue, 0);

  if (loading) return <div className="text-center py-4 text-slate-500">Loading warehouse stats...</div>;

  return (
    <div className="card">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">🏢 Sales by Warehouse</h3>
        <p className="text-sm text-slate-600">Last 30 days distribution</p>
      </div>

      {data.length === 0 ? (
        <p className="text-slate-500 text-center py-8">No warehouse data available</p>
      ) : (
        <div className="space-y-4">
          {data.map((wh, idx) => {
            const percentage = total > 0 ? (wh.totalValue / total * 100) : 0;
            return (
              <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-slate-900">{wh.warehouseName}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {wh.count} transactions • {wh.totalQty.toFixed(0)} items
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-slate-900">{percentage.toFixed(1)}%</div>
                    <div className="text-sm text-slate-600">{wh.totalValue.toFixed(2)}</div>
                  </div>
                </div>
                <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-sky-600 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
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

        const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
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
  }, []);

  if (loading) return <div className="text-center py-4 text-slate-500">Loading supplier statistics...</div>;

  return (
    <div className="card">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">🚚 Top Suppliers</h3>
        <p className="text-sm text-slate-600">Last 90 days performance</p>
      </div>

      {data.length === 0 ? (
        <p className="text-slate-500 text-center py-8">No supplier data available</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Supplier</th>
                <th className="py-2 pr-3 text-right">Deliveries</th>
                <th className="py-2 pr-3 text-right">Total Value</th>
                <th className="py-2 pr-3 text-right">Avg Order</th>
                <th className="py-2 pr-3 text-right">Last Delivery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((supp, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="py-2 pr-3 text-slate-400">{idx + 1}</td>
                  <td className="py-2 pr-3 font-medium">{supp.supplierName}</td>
                  <td className="py-2 pr-3 text-right">{supp.deliveryCount}</td>
                  <td className="py-2 pr-3 text-right font-bold">{supp.totalValue.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right">{supp.avgValue.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right">
                    <span className={`text-xs ${
                      supp.daysSinceLastDelivery <= 7 ? 'text-green-600' :
                      supp.daysSinceLastDelivery <= 30 ? 'text-slate-600' :
                      'text-amber-600'
                    }`}>
                      {supp.daysSinceLastDelivery !== null 
                        ? `${supp.daysSinceLastDelivery}d ago`
                        : 'N/A'
                      }
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

        const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
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
  }, []);

  const totalRevenue = data.reduce((sum, d) => sum + d.totalValue, 0);

  if (loading) return <div className="text-center py-4 text-slate-500">Loading customer statistics...</div>;

  return (
    <div className="card">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">⭐ Top Customers</h3>
        <p className="text-sm text-slate-600">Last 90 days by revenue</p>
      </div>

      {data.length === 0 ? (
        <p className="text-slate-500 text-center py-8">No customer data available</p>
      ) : (
        <>
          <div className="mb-6 p-4 bg-linear-to-r from-sky-50 to-purple-50 border border-sky-200 rounded-lg">
            <div className="text-sm text-slate-600">Total Revenue (Top 10)</div>
            <div className="text-3xl font-bold text-slate-900">{totalRevenue.toFixed(2)}</div>
            <div className="text-xs text-slate-500 mt-1">
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
                      <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-sm font-bold text-slate-600">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{client.clientName}</div>
                        <div className="text-xs text-slate-500">
                          {client.orderCount} orders • Avg: {client.avgOrder.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">{client.totalValue.toFixed(2)}</div>
                      <div className="text-xs text-slate-500">{share.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Last purchase:</span>
                    <span className={
                      client.daysSinceLastPurchase <= 7 ? 'text-green-600 font-medium' :
                      client.daysSinceLastPurchase <= 30 ? 'text-slate-600' :
                      'text-amber-600'
                    }>
                      {client.daysSinceLastPurchase !== null 
                        ? `${client.daysSinceLastPurchase} days ago`
                        : 'N/A'
                      }
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
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