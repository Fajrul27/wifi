import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";

export default function DashboardBandwidthChart({ routersTrafficRef, isDarkMode, selectedRouter }) {
  const [bandwidthData, setBandwidthData] = useState(() => {
    try {
      const cached = sessionStorage.getItem("dashboard_bandwidth");
      if (cached) return JSON.parse(cached);
    } catch(e) {}
    return Array.from({ length: 20 }, (_, i) => ({
      time: new Date(Date.now() - (20 - i) * 3000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      download: 0,
      upload: 0
    }));
  });

  useEffect(() => {
    setBandwidthData(Array.from({ length: 20 }, (_, i) => ({
      time: new Date(Date.now() - (20 - i) * 3000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      download: 0,
      upload: 0
    })));
  }, [selectedRouter]);

  useEffect(() => {
    const interval = setInterval(() => {
      setBandwidthData(prev => {
        const newData = [...prev.slice(1)];
        let totalRx = 0;
        let totalTx = 0;
        
        if (routersTrafficRef && routersTrafficRef.current) {
          if (selectedRouter) {
            const t = routersTrafficRef.current[selectedRouter] || routersTrafficRef.current[String(selectedRouter)] || routersTrafficRef.current[Number(selectedRouter)];
            if (t) {
              totalRx = t.rx;
              totalTx = t.tx;
            }
          } else {
            Object.values(routersTrafficRef.current).forEach(t => {
                totalRx += t.rx;
                totalTx += t.tx;
            });
          }
        }

        newData.push({
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          download: totalTx, // Router Transmit (TX) = Client Download
          upload: totalRx    // Router Receive (RX) = Client Upload
        });

        try {
          sessionStorage.setItem("dashboard_bandwidth", JSON.stringify(newData));
        } catch(e) {}
        
        return newData;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [routersTrafficRef, selectedRouter]);

  return (
    <div className="card border-0 rounded-4 d-flex flex-column bg-body shadow-sm" style={{ flex: 1, minHeight: 0 }}>
      <div className="card-header bg-transparent border-0 pt-4 pb-2 px-4">
        <h6 className="fw-bold text-body-emphasis mb-0 d-flex align-items-center gap-2">
          <i className="bi bi-graph-up-arrow text-primary"></i> Live Network Traffic
        </h6>
      </div>
      <div className="card-body px-3 pb-4 pt-0 d-flex flex-column flex-grow-1" style={{ minHeight: 0 }}>
          <div style={{ width: '100%', minHeight: '120px', flex: 1 }}>
          <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={bandwidthData} margin={{ top: 10, right: 10, left: 8, bottom: 0 }}>
                  <defs>
                      <linearGradient id="colorDownload" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00f2fe" stopOpacity={0.6}/>
                          <stop offset="95%" stopColor="#00f2fe" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorUpload" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4facfe" stopOpacity={0.6}/>
                          <stop offset="95%" stopColor="#4facfe" stopOpacity={0}/>
                      </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" hide />
                  <YAxis 
                      stroke="#64748b" 
                      fontSize={10} 
                      width={52}
                      tickFormatter={(val) => {
                          if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                          if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
                          return `${val}`;
                      }} />
                  <RechartsTooltip 
                      contentStyle={{ 
                          borderRadius: '12px', 
                          border: 'none', 
                          background: isDarkMode ? 'rgba(21, 28, 44, 0.95)' : 'rgba(255, 255, 255, 0.95)', 
                          backdropFilter: 'blur(8px)', 
                          boxShadow: isDarkMode ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.1)', 
                          color: isDarkMode ? '#f8fafc' : '#334155' 
                      }}
                      labelStyle={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: '12px', marginBottom: '4px' }}
                      itemStyle={{ color: isDarkMode ? '#f1f5f9' : '#334155' }}
                      formatter={(value, name) => {
                          let formatted = value + " bps";
                          if (value >= 1000000) formatted = (value / 1000000).toFixed(2) + " Mbps";
                          else if (value >= 1000) formatted = (value / 1000).toFixed(2) + " Kbps";
                          return [formatted, name];
                      }}
                  />
                  <Area type="monotone" dataKey="download" stroke="#00f2fe" strokeWidth={2} fillOpacity={1} fill="url(#colorDownload)" name="Download" isAnimationActive={false} />
                  <Area type="monotone" dataKey="upload" stroke="#4facfe" strokeWidth={2} fillOpacity={1} fill="url(#colorUpload)" name="Upload" isAnimationActive={false} />
              </AreaChart>
          </ResponsiveContainer>
          </div>
      </div>
    </div>
  );
}
