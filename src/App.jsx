import React, { useState } from 'react';

function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');

  // 1. จำลองราคาตลาดปัจจุบัน (Market Prices) - อนาคตจะดึงผ่าน API / Google Sheets
  const marketPrices = {
    goldSpot: 2425.50,      // ราคา ทอง Spot (USD/oz)
    gold965Buy: 43200,     // ราคารับซื้อทองแท่ง 96.5% (บาททองคำ)
    gold965Sell: 43300,    // ราคาขายออกทองแท่ง 96.5% (บาททองคำ)
    usdThb: 35.20,         // อัตราแลกเปลี่ยน (บาทต่อดอลลาร์)
  };

  // 2. จำลองคลังสินค้าทองแท่ง (Physical Stock) พร้อมต้นทุนถ่วงน้ำหนัก
  const physicalStock = [
    { id: 1, type: 'ทองคำแท่ง 96.5%', weight: 80, avgCost: 41500, unit: 'บาททองคำ' },
    { id: 2, type: 'ทองคำแท่ง 99.99%', weight: 1500, avgCost: 2720, unit: 'กรัม' },
  ];

  // 3. จำลองพอร์ตสัญญาซื้อขายล่วงหน้า (TFEX Positions)
  const tfexPositions = [
    { id: 1, symbol: 'GOU26', type: 'Long', quantity: 5, entryPrice: 2400.00, multiplier: 300 }, 
    // Gold Online Futures: ตัวคูณคือ 300 USD ต่อ 1 จุดคำนวณ
  ];

  // ==================== [ ส่วนโซนสูตรคำนวณบัญชี ] ====================

  // คำนวณมูลค่าและ P&L ของทอง 96.5%
  const gold965 = physicalStock.find(item => item.type === 'ทองคำแท่ง 96.5%');
  const gold965CurrentValue = gold965.weight * marketPrices.gold965Buy;
  const gold965TotalCost = gold965.weight * gold965.avgCost;
  const gold965PnL = gold965CurrentValue - gold965TotalCost;

  // คำนวณมูลค่าและ P&L ของทอง 99.99% (แปลงราคา Spot เป็นราคาต่อกรัม: Spot * แปลงออนซ์เป็นกรัม * อัตราแลกเปลี่ยน)
  // สูตรแปลงโดยประมาณ: (Spot / 31.104) * USDTHB
  const gold9999 = physicalStock.find(item => item.type === 'ทองคำแท่ง 99.99%');
  const gold9999MarketPricePerGram = (marketPrices.goldSpot / 31.1035) * marketPrices.usdThb;
  const gold9999CurrentValue = gold9999.weight * gold9999MarketPricePerGram;
  const gold9999TotalCost = gold9999.weight * gold9999.avgCost;
  const gold9999PnL = gold9999CurrentValue - gold9999TotalCost;

  // รวมมูลค่าสต็อกกายภาพทั้งหมด
  const totalPhysicalValue = gold965CurrentValue + gold9999CurrentValue;
  const totalPhysicalPnL = gold965PnL + gold9999PnL;

  // คำนวณ Mark-to-Market (MtM) ของพอร์ต TFEX
  const totalTfexPnLThb = tfexPositions.reduce((total, pos) => {
    // สูตรคำนวณกำไร Gold Online Futures: (ราคาปัจจุบัน - ราคาเข้าซื้อ) * จำนวนสัญญา * ตัวคูณค่างวด * อัตราแลกเปลี่ยน
    const priceDiff = marketPrices.goldSpot - pos.entryPrice;
    const pnlUsd = priceDiff * pos.quantity * pos.multiplier;
    return total + (pnlUsd * marketPrices.usdThb);
  }, 0);

  // สรุปรวมความมั่งคั่งสุทธิ (Net Asset Value)
  const netAssetValue = totalPhysicalValue + totalTfexPnLThb;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-slate-200/80 px-8 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse"></div>
          <span className="text-lg font-semibold tracking-tight">Precious Metals HQ</span>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50">
          <button onClick={() => setCurrentTab('dashboard')} className={`px-5 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${currentTab === 'dashboard' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>Dashboard</button>
          <button onClick={() => setCurrentTab('tfex')} className={`px-5 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${currentTab === 'tfex' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>TFEX</button>
          <button onClick={() => setCurrentTab('reconciliation')} className={`px-5 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${currentTab === 'reconciliation' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>ระบบตัดสต็อก</button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-8">
        {currentTab === 'dashboard' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Executive Dashboard</h1>
              <p className="text-slate-500 text-sm mt-1">สรุปภาพรวมสินทรัพย์และการป้องกันความเสี่ยงของบริษัท</p>
            </div>

            {/* แถบราคาตลาดจอยักษ์ (Market Rates Ticker) */}
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
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">ทองคำ 96.5% (รับซื้อ)</p>
                <p className="text-xl font-bold text-slate-800 mt-1">฿{marketPrices.gold965Buy.toLocaleString()}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">ทองคำ 96.5% (ขายออก)</p>
                <p className="text-xl font-bold text-slate-800 mt-1">฿{marketPrices.gold965Sell.toLocaleString()}</p>
              </div>
            </div>

            {/* แผงควบคุมสรุปตัวเลขใหญ่ 3 ด้าน (Top-level Metrics) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* การ์ดที่ 1: มูลค่าสินทรัพย์รวมสุทธิ */}
              <div className="p-6 bg-slate-900 text-white rounded-[2rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl"></div>
                <p className="text-sm font-medium text-slate-400">มูลค่าสินทรัพย์รวมสุทธิ (NAV)</p>
                <p className="text-3xl font-bold tracking-tight mt-2">฿{netAssetValue.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                <p className="text-xs text-slate-400 mt-4">รวมสต็อกกายภาพ + กำไรสะสมพอร์ต TFEX</p>
              </div>

              {/* การ์ดที่ 2: กำไร/ขาดทุน สต็อกทองคำแท่ง */}
              <div className="p-6 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm">
                <p className="text-sm font-medium text-slate-500">กำไร/ขาดทุน สต็อกทองคำแท่ง</p>
                <p className={`text-3xl font-bold tracking-tight mt-2 ${totalPhysicalPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {totalPhysicalPnL >= 0 ? '+' : ''}฿{totalPhysicalPnL.toLocaleString(undefined, {maximumFractionDigits: 2})}
                </p>
                <div className="flex items-center space-x-2 mt-4 text-xs text-slate-500">
                  <span>มูลค่าคงเหลือ: ฿{totalPhysicalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                </div>
              </div>

              {/* การ์ดที่ 3: กำไร/ขาดทุน TFEX (MtM) */}
              <div className="p-6 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm">
                <p className="text-sm font-medium text-slate-500">กำไร/ขาดทุน Hedging TFEX</p>
                <p className={`text-3xl font-bold tracking-tight mt-2 ${totalTfexPnLThb >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {totalTfexPnLThb >= 0 ? '+' : ''}฿{totalTfexPnLThb.toLocaleString(undefined, {maximumFractionDigits: 2})}
                </p>
                <p className="text-xs text-slate-400 mt-4">อิงตามราคาสัญญาปัจจุบันในตลาดแบบประเมินมูลค่า (MtM)</p>
              </div>
            </div>

            {/* ตารางรายละเอียดคลังสินค้าทางกายภาพ */}
            <div className="p-6 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-4">รายการคลังสินค้าคงเหลือ (Physical Assets)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-medium">
                      <th className="pb-3">ประเภทโลหะมีค่า</th>
                      <th className="pb-3 text-right">น้ำหนักในคลัง</th>
                      <th className="pb-3 text-right">ต้นทุนเฉลี่ย</th>
                      <th className="pb-3 text-right">ราคาตลาด</th>
                      <th className="pb-3 text-right">ผลกำไร/ขาดทุน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 font-semibold text-slate-800">ทองคำแท่ง 96.5%</td>
                      <td className="py-4 text-right font-medium">{gold965.weight.toLocaleString()} {gold965.unit}</td>
                      <td className="py-4 text-right">฿{gold965.avgCost.toLocaleString()}</td>
                      <td className="py-4 text-right">฿{marketPrices.gold965Buy.toLocaleString()}</td>
                      <td className={`py-4 text-right font-bold ${gold965PnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ฿{gold965PnL.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 font-semibold text-slate-800">ทองคำแท่ง 99.99%</td>
                      <td className="py-4 text-right font-medium">{gold9999.weight.toLocaleString()} {gold9999.unit}</td>
                      <td className="py-4 text-right">฿{gold9999.avgCost.toLocaleString()}/ก.</td>
                      <td className="py-4 text-right">฿{gold9999MarketPricePerGram.toLocaleString(undefined, {maximumFractionDigits: 2})}/ก.</td>
                      <td className={`py-4 text-right font-bold ${gold9999PnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ฿{gold9999PnL.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {currentTab === 'tfex' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">TFEX Management</h1>
            <p className="text-slate-500 text-sm">จัดการสถานะและบริหารความเสี่ยงพอร์ตประกัน</p>
          </div>
        )}

        {currentTab === 'reconciliation' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Stock Reconciliation</h1>
            <p className="text-slate-500 text-sm">ระบบตัดสต็อกกระทบยอดหน้างาน</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;