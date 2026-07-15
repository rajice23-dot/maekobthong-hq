import React, { useState, useEffect } from 'react';

// 🚨 นำลิงก์ Web App URL ตัวใหม่ล่าสุดที่เพิ่งก๊อปปี้เมื่อสักครู่ มาวางแทนที่ตรงนี้ครับน้า!
const API_URL = "https://script.google.com/macros/s/AKfycbzNV4EzEBcmyu6VOwK8AMNEKtRMMPU9cz6h_lGxPRLcb4j5fwDttaVVWtgz5mM1UbzR/exec"; 

function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [sheetData, setSheetData] = useState({ orders: [], orderDetails: [], metrics: { totalAssetValue: 0, totalOrdersCount: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. ราคาตลาดปัจจุบัน (Market Prices)
  const marketPrices = {
    goldSpot: 2425.50,
    gold965Buy: 43200,
    gold965Sell: 43300,
    usdThb: 35.20,
  };

  // 2. จำลองพอร์ตสัญญาซื้อขายล่วงหน้า (TFEX Positions) - ล็อกไว้ให้หน้าจอไม่โล่ง
  const tfexPositions = [
    { id: 1, symbol: 'GOU26', type: 'Long', quantity: 5, entryPrice: 2400.00, multiplier: 300 },
  ];

  // ฟังก์ชันวิ่งไปดึงข้อมูลจริงจาก Google Sheets 
  useEffect(() => {
    if (API_URL === "วาง_URL_ใหม่ของน้าตรงนี้ครับ") {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${API_URL}?action=getDashboard`)
      .then(res => res.json())
      .then(result => {
        if (result.status === "success") {
          setSheetData(result);
          setError(null);
        } else {
          setError(result.message);
        }
        setLoading(false);
      })
      .catch(err => {
        setError("ไม่สามารถเชื่อมต่อ Google Sheets ได้ (กรุณาเช็กการตั้งค่าให้เป็น Execute as: Me และ Anyone ใน Web App)");
        setLoading(false);
      });
  }, []);

  // คำนวณกำไรพอร์ต TFEX 
  const tfexRows = tfexPositions.map(pos => {
    const priceDiff = marketPrices.goldSpot - pos.entryPrice;
    const pnlUsd = priceDiff * pos.quantity * pos.multiplier;
    const pnlThb = pnlUsd * marketPrices.usdThb;
    return { ...pos, pnlThb };
  });
  const totalTfexPnLThb = tfexRows.reduce((sum, item) => sum + item.pnlThb, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Navigation Bar - มีเมนูครบ 3 แท็บเหมือนเดิมครับน้า */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-slate-200/80 px-8 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse"></div>
          <span className="text-lg font-semibold tracking-tight">Precious Metals HQ</span>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50">
          <button onClick={() => setCurrentTab('dashboard')} className={`px-5 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${currentTab === 'dashboard' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>Dashboard</button>
          <button onClick={() => setCurrentTab('tfex')} className={`px-5 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${currentTab === 'tfex' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>TFEX</button>
          <button onClick={() => setCurrentTab('reconciliation')} className={`px-5 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${currentTab === 'reconciliation' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>ระบบตัดสต็อกหน้าร้าน</button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-8">
        
        {/* สถานะกำลังโหลด */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 text-sm font-medium">กำลังเปิดตู้เซฟเชื่อมท่อข้อมูล Google Sheets...</p>
          </div>
        )}

        {/* สถานะเชื่อมต่อผิดพลาด */}
        {!loading && error && (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-[2rem] text-center max-w-2xl mx-auto mt-12 shadow-sm">
            <p className="text-rose-700 font-bold text-lg">เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล</p>
            <p className="text-rose-500 text-sm mt-2 bg-white p-4 rounded-xl border border-rose-100 font-mono text-left break-all">{error}</p>
            <p className="text-slate-500 text-xs mt-4">💡 วิธีแก้: ในหน้า Apps Script ให้กด Deploy ใหม่ ปรับตรง Execute as ให้เป็น "Me" และ Who has access ให้เป็น "Anyone"</p>
          </div>
        )}

        {/* หน้าจอทำงานปกติ (เมื่อท่อข้อมูลเชื่อมต่อผ่านฉลุย) */}
        {!loading && !error && (
          <>
            {/* แท็บที่ 1: EXECUTIVE DASHBOARD */}
            {currentTab === 'dashboard' && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900">Executive Dashboard</h1>
                  <p className="text-slate-500 text-sm mt-1">สรุปภาพรวมสินทรัพย์และการป้องกันความเสี่ยง (เชื่อมต่อข้อมูลสดจาก Google Sheets)</p>
                </div>

                {/* ราคากลางตลาด Ticker */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Gold Spot</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">${marketPrices.goldSpot.toLocaleString()}</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">USD / THB</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">฿{marketPrices.usdThb.toFixed(2)}</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">ทอง 96.5% (ซื้อ)</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">฿{marketPrices.gold965Buy.toLocaleString()}</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">ทอง 96.5% (ขาย)</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">฿{marketPrices.gold965Sell.toLocaleString()}</p>
                  </div>
                </div>

                {/* การ์ดสรุปตัวเลขใหญ่ระดับผู้บริหาร */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 bg-slate-900 text-white rounded-[2rem] shadow-xl relative overflow-hidden">
                    <p className="text-sm font-medium text-slate-400">ยอดรวมทุนซื้อเข้าในชีตสุทธิ</p>
                    <p className="text-3xl font-bold tracking-tight mt-2">฿{sheetData.metrics.totalAssetValue.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                    <p className="text-xs text-slate-400 mt-4">คำนวณอัตโนมัติจากตาราง Orders จริง</p>
                  </div>
                  <div className="p-6 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm">
                    <p className="text-sm font-medium text-slate-500">จำนวนบิลธุรกรรมสะสม</p>
                    <p className="text-3xl font-bold tracking-tight text-indigo-600 mt-2">{sheetData.metrics.totalOrdersCount} รายการ</p>
                    <p className="text-xs text-slate-400 mt-4">จำนวนแถวข้อมูลที่บันทึกหน้าร้าน</p>
                  </div>
                  <div className="p-6 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm">
                    <p className="text-sm font-medium text-slate-500">กำไร/ขาดทุน Hedging TFEX</p>
                    <p className={`text-3xl font-bold tracking-tight mt-2 ${totalTfexPnLThb >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {totalTfexPnLThb >= 0 ? '+' : ''}฿{totalTfexPnLThb.toLocaleString(undefined, {maximumFractionDigits: 2})}
                    </p>
                    <p className="text-xs text-slate-400 mt-4">Mark-to-Market จากพอร์ตประกันความเสี่ยง</p>
                  </div>
                </div>

                {/* ตารางแสดงบิลล่าสุดจาก Google Sheets */}
                <div className="p-6 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">ตารางบิลซื้อเข้าล่าสุดหน้าร้าน (Orders Sheet)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-medium">
                          <th className="pb-3">รหัสบิลออเดอร์</th>
                          <th className="pb-3">ชื่อลูกค้า</th>
                          <th className="pb-3">เบอร์โทร</th>
                          <th className="pb-3">วัตถุประสงค์</th>
                          <th className="pb-3 text-right">ยอดเงินรวมสุทธิ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {sheetData.orders.slice(-5).reverse().map((order, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 font-mono font-bold text-slate-800">{order.orderId}</td>
                            <td className="py-4 font-medium">{order.customerName || 'ทั่วไป'}</td>
                            <td className="py-4 text-slate-500">{order.phone || '-'}</td>
                            <td className="py-4"><span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-md">{order.purpose || 'ขายทองเก่า'}</span></td>
                            <td className="py-4 text-right font-bold text-slate-900">฿{order.grandTotal.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* แท็บที่ 2: TFEX Hedging Portfolio */}
            {currentTab === 'tfex' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900">TFEX Hedging Portfolio</h1>
                  <p className="text-slate-500 text-sm mt-1">รายการสัญญาประกันความเสี่ยงราคาทองคำในตลาดล่วงหน้า</p>
                </div>
                <div className="p-6 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">รายการสัญญาเปิดคงค้าง (Open Positions)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-medium">
                          <th className="pb-3">ชื่อสัญญา</th>
                          <th className="pb-3">สถานะ</th>
                          <th className="pb-3 text-right">จำนวนสัญญา</th>
                          <th className="pb-3 text-right">ต้นทุนเฉลี่ย (USD)</th>
                          <th className="pb-3 text-right">ราคาตลาดล่าสุด</th>
                          <th className="pb-3 text-right">กำไร/ขาดทุน (บาท)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {tfexRows.map(pos => (
                          <tr key={pos.id}>
                            <td className="py-4 font-bold text-slate-800">{pos.symbol}</td>
                            <td className="py-4"><span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">{pos.type}</span></td>
                            <td className="py-4 text-right font-medium">{pos.quantity} สัญญา</td>
                            <td className="py-4 text-right">${pos.entryPrice.toLocaleString()}</td>
                            <td className="py-4 text-right">${marketPrices.goldSpot.toLocaleString()}</td>
                            <td className={`py-4 text-right font-bold ${pos.pnlThb >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {pos.pnlThb >= 0 ? '+' : ''}฿{pos.pnlThb.toLocaleString(undefined, {maximumFractionDigits: 2})}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* แท็บที่ 3: ระบบคลังสินค้าแยกชิ้นตัดสต็อก */}
            {currentTab === 'reconciliation' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900">Stock Reconciliation</h1>
                  <p className="text-slate-500 text-sm mt-1">ข้อมูลวิเคราะห์รายชิ้น ทอง/เงิน/ขยะอิเล็กทรอนิกส์ ดึงประวัติสดจากชีต OrderDetails</p>
                </div>
                <div className="p-6 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">บันทึกคลังสินค้าดิบรายชิ้น (OrderDetails Sheet)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-medium">
                          <th className="pb-3">รหัสบิลอ้างอิง</th>
                          <th className="pb-3">ประเภท</th>
                          <th className="pb-3 text-right">น้ำหนักก่อน (g)</th>
                          <th className="pb-3 text-right">น้ำหนักหลัง (g)</th>
                          <th className="pb-3 text-center">ความบริสุทธิ์ X-Ray</th>
                          <th className="pb-3 text-right">ราคาตลาดตอนซื้อ</th>
                          <th className="pb-3 text-right">ยอดสุทธิชิ้นนี้</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {sheetData.orderDetails.slice().reverse().map((detail, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 font-mono text-xs text-slate-400">{detail.orderId}</td>
                            <td className="py-4 font-bold text-slate-800">
                              <span className={`px-2 py-0.5 rounded-lg text-xs ${detail.itemType === 'ทอง' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-700'}`}>
                                {detail.itemType}
                              </span>
                            </td>
                            <td className="py-4 text-right font-medium">{detail.weightBefore} ก.</td>
                            <td className="py-4 text-right font-medium text-indigo-600">{detail.weightAfter} ก.</td>
                            <td className="py-4 text-center font-bold text-emerald-600">{detail.percent}%</td>
                            <td className="py-4 text-right">฿{detail.marketPrice.toLocaleString()}</td>
                            <td className="py-4 text-right font-bold text-slate-900">฿{detail.itemTotal.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;