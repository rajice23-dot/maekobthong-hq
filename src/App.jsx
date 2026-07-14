import React, { useState } from 'react';

function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');

  // 1. จำลองราคาตลาดปัจจุบัน (Market Prices)
  const marketPrices = {
    goldSpot: 2425.50,
    gold965Buy: 43200,
    gold965Sell: 43300,
    usdThb: 35.20,
  };

  // 2. จำลองคลังสินค้าทองแท่ง (Physical Stock)
  const physicalStock = [
    { id: 1, type: 'ทองคำแท่ง 96.5%', weight: 80, avgCost: 41500, unit: 'บาททองคำ' },
    { id: 2, type: 'ทองคำแท่ง 99.99%', weight: 1500, avgCost: 2720, unit: 'กรัม' },
  ];

  // 3. จำลองพอร์ตสัญญาซื้อขายล่วงหน้า (TFEX Positions)
  const tfexPositions = [
    { id: 1, symbol: 'GOU26', type: 'Long', quantity: 5, entryPrice: 2400.00, multiplier: 300 },
  ];

  // 4. จำลองข้อมูลรับซื้อหน้าร้าน "แม่กบทอง" (X-ray % ความบริสุทธิ์จ่ายเงินสด)
  const recentPurchases = [
    { id: 'TX-901', item: 'สร้อยคอทองคำเก่าชำรุด', xrayPurity: '92.1%', weight: '15.20 กรัม', cashPaid: 38500, status: 'รอหลอมแยกประเภท' },
    { id: 'TX-902', item: 'เศษแผ่นนาก/แพลตตินัมผสม', xrayPurity: '78.5%', weight: '8.40 กรัม', cashPaid: 9200, status: 'รอส่งโรงสกัด' },
    { id: 'TX-903', item: 'ขยะอิเล็กทรอนิกส์ (บอร์ดมือถือคละ)', xrayPurity: 'ประเมินสกัด', weight: '24.50 กิโลกรัม', cashPaid: 4500, status: 'คัดแยกคลังสินค้า' },
  ];

  // ==================== [ ส่วนโซนสูตรคำนวณบัญชี ] ====================
  const gold965 = physicalStock.find(item => item.type === 'ทองคำแท่ง 96.5%');
  const gold965CurrentValue = gold965.weight * marketPrices.gold965Buy;
  const gold965TotalCost = gold965.weight * gold965.avgCost;
  const gold965PnL = gold965CurrentValue - gold965TotalCost;

  // แก้ไขจุดพิมพ์ผิดจาก 'ทองայինแท่ง' เป็น 'ทองคำแท่ง' เรียบร้อยครับ
  const gold9999 = physicalStock.find(item => item.type === 'ทองคำแท่ง 99.99%');
  const gold9999MarketPricePerGram = (marketPrices.goldSpot / 31.1035) * marketPrices.usdThb;
  const gold9999CurrentValue = gold9999.weight * gold9999MarketPricePerGram;
  const gold9999TotalCost = gold9999.weight * gold9999.avgCost;
  const gold9999PnL = gold9999CurrentValue - gold9999TotalCost;

  const totalPhysicalValue = gold965CurrentValue + gold9999CurrentValue;
  const totalPhysicalPnL = gold965PnL + gold9999PnL;

  // คำนวณ MtM ของ TFEX รายสัญญา
  const tfexRows = tfexPositions.map(pos => {
    const priceDiff = marketPrices.goldSpot - pos.entryPrice;
    const pnlUsd = priceDiff * pos.quantity * pos.multiplier;
    const pnlThb = pnlUsd * marketPrices.usdThb;
    return { ...pos, pnlThb };
  });

  const totalTfexPnLThb = tfexRows.reduce((sum, item) => sum + item.pnlThb, 0);
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
        
        {/* แท็บที่ 1: EXECUTIVE DASHBOARD */}
        {currentTab === 'dashboard' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Executive Dashboard</h1>
              <p className="text-slate-500 text-sm mt-1">สรุปภาพรวมสินทรัพย์และการป้องกันความเสี่ยงของบริษัท</p>
            </div>

            {/* แถบราคาตลาดจอยักษ์ */}
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

            {/* แผงควบคุมสรุปตัวเลขใหญ่ 3 ด้าน */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-slate-900 text-white rounded-[2rem] shadow-xl relative overflow-hidden">
                <p className="text-sm font-medium text-slate-400">มูลค่าสินทรัพย์รวมสุทธิ (NAV)</p>
                <p className="text-3xl font-bold tracking-tight mt-2">฿{netAssetValue.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                <p className="text-xs text-slate-400 mt-4">รวมสต็อกกายภาพ + กำไรสะสมพอร์ต TFEX</p>
              </div>

              <div className="p-6 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm">
                <p className="text-sm font-medium text-slate-500">กำไร/ขาดทุน สต็อกทองคำแท่ง</p>
                <p className={`text-3xl font-bold tracking-tight mt-2 ${totalPhysicalPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {totalPhysicalPnL >= 0 ? '+' : ''}฿{totalPhysicalPnL.toLocaleString(undefined, {maximumFractionDigits: 2})}
                </p>
                <p className="text-xs text-slate-400 mt-4">มูลค่าคงเหลือ: ฿{totalPhysicalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
              </div>

              <div className="p-6 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm">
                <p className="text-sm font-medium text-slate-500">กำไร/ขาดทุน Hedging TFEX</p>
                <p className={`text-3xl font-bold tracking-tight mt-2 ${totalTfexPnLThb >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {totalTfexPnLThb >= 0 ? '+' : ''}฿{totalTfexPnLThb.toLocaleString(undefined, {maximumFractionDigits: 2})}
                </p>
                <p className="text-xs text-slate-400 mt-4">อิงตามราคาสัญญาปัจจุบันในตลาดล่วงหน้า (MtM)</p>
              </div>
            </div>

            {/* ตารางคลังสินค้า */}
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
                    <tr>
                      <td className="py-4 font-semibold text-slate-800">ทองคำแท่ง 96.5%</td>
                      <td className="py-4 text-right font-medium">{gold965.weight} {gold965.unit}</td>
                      <td className="py-4 text-right">฿{gold965.avgCost.toLocaleString()}</td>
                      <td className="py-4 text-right">฿{marketPrices.gold965Buy.toLocaleString()}</td>
                      <td className={`py-4 text-right font-bold ${gold965PnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>฿{gold965PnL.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="py-4 font-semibold text-slate-800">ทองคำแท่ง 99.99%</td>
                      <td className="py-4 text-right font-medium">{gold9999.weight} {gold9999.unit}</td>
                      <td className="py-4 text-right">฿{gold9999.avgCost.toLocaleString()}/ก.</td>
                      <td className="py-4 text-right">฿{gold9999MarketPricePerGram.toLocaleString(undefined, {maximumFractionDigits: 2})}/ก.</td>
                      <td className={`py-4 text-right font-bold ${gold9999PnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>฿{gold9999PnL.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* แท็บที่ 2: TFEX MANAGEMENT */}
        {currentTab === 'tfex' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">TFEX Hedging Portfolio</h1>
              <p className="text-slate-500 text-sm mt-1">พอร์ตสัญญาซื้อขายล่วงหน้าเพื่อประกันความเสี่ยงราคาทองคำผันผวน</p>
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
                        <td className="py-4">
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">{pos.type}</span>
                        </td>
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

        {/* แท็บที่ 3: ระบบตัดสต็อกหน้าร้าน "แม่กบทอง" */}
        {currentTab === 'reconciliation' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Stock Reconciliation</h1>
              <p className="text-slate-500 text-sm mt-1">ระบบกระทบยอดตัดสต็อกสินค้าเก่า เงิน ทอง นาก แพลตตินัม และขยะอิเล็กทรอนิกส์</p>
            </div>

            <div className="p-6 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800">บันทึกรายการซื้อเข้าหน้าร้านวันนี้ (จ่ายเงินสด)</h3>
                <span className="text-xs font-semibold bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-200">แม่กบทอง ยุติธรรม • แม่นยำด้วย X-ray</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-medium">
                      <th className="pb-3">เลขที่ตัั่ว</th>
                      <th className="pb-3">รายการสินค้า</th>
                      <th className="pb-3 text-center">ความบริสุทธิ์ (X-Ray)</th>
                      <th className="pb-3 text-right">น้ำหนักชั่งจริง</th>
                      <th className="pb-3 text-right">เงินสดที่จ่าย</th>
                      <th className="pb-3 text-center">สถานะสต็อก</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recentPurchases.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 font-mono text-xs text-slate-400">{item.id}</td>
                        <td className="py-4 font-semibold text-slate-800">{item.item}</td>
                        <td className="py-4 text-center font-bold text-indigo-600 bg-indigo-50/30 rounded-xl">{item.xrayPurity}</td>
                        <td className="py-4 text-right font-medium">{item.weight}</td>
                        <td className="py-4 text-right font-bold text-slate-900">฿{item.cashPaid.toLocaleString()}</td>
                        <td className="py-4 text-center">
                          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200">{item.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;