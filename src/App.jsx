import React, { useState, useEffect } from 'react';

// 💡 เสียบสายลิงก์ API ตัวล่าสุดของคุณเรียบร้อยครับ
const API_URL = "https://script.google.com/macros/s/AKfycbzNV4EzEBcmyu6VOwK8AMNEKtRMMPU9cz6h_lGxPRLcb4j5fwDttaVVWtgz5mM1UbzR/exec"; 
const GRAMS_PER_BAHT_9999 = 15.16;

function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [sheetData, setSheetData] = useState({ 
    orders: [], 
    orderDetails: [], 
    metrics: { totalAssetValue: 0, totalOrdersCount: 0 },
    marketPrices: { goldSpot: 2425.50, gold965Buy: 43200, gold965Sell: 43300, usdThb: 35.20 } // สแตนด์บายราคารองรับ
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedMonth, setSelectedMonth] = useState('All'); 
  const [initialBudget, setInitialBudget] = useState('2000000'); 
  const [selectedItems, setSelectedItems] = useState({});
  const [targetPrices, setTargetPrices] = useState({
    goldSalePricePerBaht: '',      
    silverSalePricePerGram: '',    
    platinumSalePricePerGram: '',  
  });

  // ดึงค่าราคาสดจาก API สมาคมฯ ที่ส่งต่อมาจากระบบหลังบ้าน
  const livePrices = sheetData.marketPrices || { goldSpot: 2425.50, gold965Buy: 43200, gold965Sell: 43300, usdThb: 35.20 };

  const tfexPositions = [
    { id: 1, symbol: 'GOU26', type: 'Long', quantity: 5, entryPrice: 2400.00, multiplier: 300 },
  ];

  const fetchData = () => {
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
        setError("ไม่สามารถเชื่อมต่อ Google Sheets ได้");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getMonthYearStr = (dateVal) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) {
      const parts = String(dateVal).split('T')[0].split('-');
      if (parts.length >= 2) return `${parts[0]}-${parts[1]}`;
      return '';
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  };

  const formatThaiMonth = (monthStr) => {
    if (!monthStr || monthStr === 'All') return 'แสดงข้อมูลสะสมทั้งหมด';
    const parts = monthStr.split('-');
    const [yyyy, mm] = parts;
    const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    return `${months[parseInt(mm) - 1]} ${parseInt(yyyy) + 543}`;
  };

  const uniqueMonths = Array.from(
    new Set(sheetData.orders.map(o => getMonthYearStr(o.date)).filter(Boolean))
  ).sort().reverse();

  // ==================== [ ส่วนประมวลผลลอจิกแดชบอร์ดตามสเปกข้อ 3 ] ====================
  const getDashboardMetrics = () => {
    let monthlyPurchases = 0;
    let uniqueOrders = new Set();
    
    let goldWeight = 0, goldPuritySum = 0, goldCost = 0, goldFee = 0, goldMarketPriceSum = 0;
    let silverWeight = 0, silverPuritySum = 0, silverCost = 0, silverFee = 0, silverMarketPriceSum = 0;
    let platinumWeight = 0, platinumPuritySum = 0, platinumCost = 0, platinumFee = 0, platinumMarketPriceSum = 0;

    sheetData.orders.forEach(order => {
      const mStr = getMonthYearStr(order.date);
      if (selectedMonth === 'All' || mStr === selectedMonth) {
        monthlyPurchases += order.grandTotal;
        uniqueOrders.add(order.orderId);
      }
    });

    sheetData.orderDetails.forEach(item => {
      const parentOrder = sheetData.orders.find(o => o.orderId === item.orderId);
      const mStr = parentOrder ? getMonthYearStr(parentOrder.date) : '';
      
      if (selectedMonth === 'All' || mStr === selectedMonth) {
        const itemFeeTotal = item.weightAfter * item.fee;

        if (item.itemType === 'ทอง') {
          goldWeight += item.weightAfter;
          goldPuritySum += (item.weightAfter * item.percent);
          goldCost += item.itemTotal;
          goldFee += itemFeeTotal;
          goldMarketPriceSum += (item.weightAfter * item.marketPrice);
        } else if (item.itemType === 'เงิน') {
          silverWeight += item.weightAfter;
          silverPuritySum += (item.weightAfter * item.percent);
          silverCost += item.itemTotal;
          silverFee += itemFeeTotal;
          silverMarketPriceSum += (item.weightAfter * item.marketPrice);
        } else if (item.itemType === 'แพลตตินัม' || item.itemType === 'แพลทินัม') {
          platinumWeight += item.weightAfter;
          platinumPuritySum += (item.weightAfter * item.percent);
          platinumCost += item.itemTotal;
          platinumFee += itemFeeTotal;
          platinumMarketPriceSum += (item.weightAfter * item.marketPrice);
        }
      }
    });

    const avgGoldPurity = goldWeight > 0 ? (goldPuritySum / goldWeight) : 0;
    const avgSilverPurity = silverWeight > 0 ? (silverPuritySum / silverWeight) : 0;
    const avgPlatinumPurity = platinumWeight > 0 ? (platinumPuritySum / platinumWeight) : 0;

    const avgGoldMarketPrice = goldWeight > 0 ? (goldMarketPriceSum / goldWeight) : 0;
    const avgSilverMarketPrice = silverWeight > 0 ? (silverMarketPriceSum / silverWeight) : 0;
    const avgPlatinumMarketPrice = platinumWeight > 0 ? (platinumMarketPriceSum / platinumWeight) : 0;

    const pureGoldGrams = goldWeight * (avgGoldPurity / 100);
    const pureGoldBaht = pureGoldGrams / GRAMS_PER_BAHT_9999;
    const pureSilverGrams = silverWeight * (avgSilverPurity / 100);
    const purePlatinumGrams = platinumWeight * (avgPlatinumPurity / 100);

    const rawGoldAvgCost = pureGoldBaht > 0 ? (goldCost / pureGoldBaht) : 0;
    const rawSilverAvgCost = pureSilverGrams > 0 ? (silverCost / pureSilverGrams) : 0;

    const gSalePrice = parseFloat(targetPrices.goldSalePricePerBaht) || 0;
    const goldPnL = gSalePrice > 0 ? ((pureGoldBaht * gSalePrice) - goldCost) : 0;
    const goldTradingPnL = goldPnL !== 0 ? (goldPnL - goldFee) : 0;

    const sSalePrice = parseFloat(targetPrices.silverSalePricePerGram) || 0;
    const silverPnL = sSalePrice > 0 ? ((pureSilverGrams * sSalePrice) - silverCost) : 0;
    const silverTradingPnL = silverPnL !== 0 ? (silverPnL - silverFee) : 0;

    const platinumPnL = 0; 

    const totalCostAll = goldCost + silverCost + platinumCost;
    const totalFeeAll = goldFee + silverFee + platinumFee;
    const totalPnLAll = goldPnL + silverPnL;

    const budgetNum = parseFloat(initialBudget) || 0;
    const fixedOpex = 15000; 
    const cashBalance = budgetNum - monthlyPurchases - fixedOpex;

    return {
      monthlyPurchases,
      customersCount: uniqueOrders.size,
      goldWeight, pureGoldBaht, goldCost, goldFee, goldTradingPnL, goldPnL, rawGoldAvgCost, avgGoldMarketPrice,
      silverWeight, pureSilverGrams, silverCost, silverFee, silverTradingPnL, silverPnL, rawSilverAvgCost, avgSilverMarketPrice,
      platinumWeight, purePlatinumGrams, platinumCost, platinumFee, avgPlatinumMarketPrice,
      totalCostAll, totalFeeAll, totalPnLAll, cashBalance
    };
  };

  const metrics = getDashboardMetrics();

  const toggleItemSelection = (orderId, itemNo) => {
    const key = `${orderId}-${itemNo}`;
    setSelectedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSelectAll = (items) => {
    const allSelected = items.every(item => selectedItems[`${item.orderId}-${item.itemNo}`]);
    const newSelections = { ...selectedItems };
    items.forEach(item => { newSelections[`${item.orderId}-${item.itemNo}`] = !allSelected; });
    setSelectedItems(newSelections);
  };

  const batch = getDashboardMetrics(); 

  const tfexRows = tfexPositions.map(pos => {
    const priceDiff = livePrices.goldSpot - pos.entryPrice;
    const pnlUsd = priceDiff * pos.quantity * pos.multiplier;
    const pnlThb = pnlUsd * livePrices.usdThb;
    return { ...pos, pnlThb };
  });
  const totalTfexPnLThb = tfexRows.reduce((sum, item) => sum + item.pnlThb, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-slate-200/80 px-8 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse"></div>
          <span className="text-lg font-semibold tracking-tight">Precious Metals HQ</span>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50">
          <button onClick={() => setCurrentTab('dashboard')} className={`px-5 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${currentTab === 'dashboard' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>Dashboard ภาพรวม</button>
          <button onClick={() => setCurrentTab('tfex')} className={`px-5 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${currentTab === 'tfex' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>TFEX บริหารพอร์ต</button>
          <button onClick={() => setCurrentTab('reconciliation')} className={`px-5 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${currentTab === 'reconciliation' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>ระบบตัดสต็อกส่งขาย</button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-8">
        
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 text-sm font-medium">กำลังดึงข้อมูลและราคาสมาคมแบบสดวินาทีต่อวินาที...</p>
          </div>
        )}

        {!loading && error && (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-[2rem] text-center max-w-2xl mx-auto mt-12 shadow-sm">
            <p className="text-rose-700 font-bold text-lg">เกิดข้อผิดพลาดในการเชื่อมต่อ</p>
            <p className="text-rose-500 text-sm mt-2 bg-white p-4 rounded-xl border border-rose-100 font-mono text-left break-all">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* แท็บที่ 1: EXECUTIVE DASHBOARD */}
            {currentTab === 'dashboard' && (
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Executive Financial Overview</h1>
                    <p className="text-slate-500 text-sm mt-1">รายงานสถานะการเงิน ต้นทุนสินค้า และข้อมูลสำหรับผู้บริหารสูงสุด</p>
                  </div>
                  
                  <div className="flex items-center gap-3 bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-xs w-full md:w-auto">
                    <span className="text-xs font-semibold text-slate-400 pl-2">รอบประมวลผล:</span>
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-bold text-slate-700 cursor-pointer">
                      <option value="All">🗓️ ยอดสะสมคลังทั้งหมด</option>
                      {uniqueMonths.map(m => (
                        <option key={m} value={m}>{formatThaiMonth(m)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 🚨 แถบราคาตลาดจอยักษ์ ดึงราคาสมาคมแท้ตัวจริงจาก API วินาทีต่อวินาที */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">สมาคมฯ รับซื้อ (Live)</p>
                    <p className="text-xl font-bold text-amber-600 mt-1">฿{livePrices.gold965Buy.toLocaleString()}</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">สมาคมฯ ขายออก (Live)</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">฿{livePrices.gold965Sell.toLocaleString()}</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Gold Spot (Indicator)</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">${livePrices.goldSpot.toLocaleString()}</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">อัตราแลกเปลี่ยน (USD/THB)</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">฿{livePrices.usdThb.toFixed(2)}</p>
                  </div>
                </div>

                {/* แผงที่ 1: ภาพรวมทางการเงิน */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="p-6 bg-slate-900 text-white rounded-[2rem] shadow-md space-y-2">
                    <p className="text-xs font-medium text-slate-400 uppercase">ยอดทุนรับซื้อสะสมรวม</p>
                    <p className="text-2xl font-black font-mono">฿{metrics.monthlyPurchases.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400">{formatThaiMonth(selectedMonth)}</p>
                  </div>
                  <div className="p-6 bg-white border border-slate-200/60 rounded-[2rem] shadow-xs space-y-2">
                    <p className="text-xs font-medium text-slate-400 uppercase">จำนวนลูกค้าหน้าร้าน</p>
                    <p className="text-2xl font-bold text-indigo-600 font-mono">{metrics.customersCount} รายการบิล</p>
                    <p className="text-[10px] text-slate-400">นับจากรหัสตั๋วซื้อ Unique OrderID</p>
                  </div>
                  <div className="p-6 bg-white border border-slate-200/60 rounded-[2rem] shadow-xs space-y-2">
                    <label className="block text-xs font-medium text-slate-400 uppercase">ตั้งงบทุนหมุนเวียนเริ่มต้น</label>
                    <input type="number" value={initialBudget} onChange={(e) => setInitialBudget(e.target.value)} className="w-full px-2 py-0.5 text-base font-bold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono focus:outline-none" />
                  </div>
                  <div className={`p-6 rounded-[2rem] shadow-xs space-y-2 border ${metrics.cashBalance < 200000 ? 'bg-rose-50 border-rose-200 text-rose-900 animate-pulse' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                    <p className="text-xs font-semibold uppercase">กระแสเงินสดคงเหลือ (Cash Balance)</p>
                    <p className="text-2xl font-black font-mono">฿{metrics.cashBalance.toLocaleString()}</p>
                    <p className="text-[10px] opacity-80">{metrics.cashBalance < 200000 ? '⚠️ เตือน! เงินสดต่ำกว่าเกณฑ์ 200,000 บาท' : '✓ สถานะเงินหมุนเวียนปลอดภัย'}</p>
                  </div>
                </div>

                {/* แผงที่ 2: สรุปต้นทุนสินค้าแยกประเภท */}
                <div className="p-6 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm space-y-6">
                  <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2">📦 คลังสต็อกโลหะมีค่าบริสุทธิ์เทียบเท่า 99.99% และต้นทุนถ่วงน้ำหนัก</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-5 bg-amber-50/40 rounded-2xl border border-amber-100 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-amber-800 uppercase">คลังทองคำ 99.99%</p>
                        <p className="text-xl font-black text-slate-800 mt-2 font-mono">{metrics.pureGoldBaht.toFixed(2)} บาททอง</p>
                        <p className="text-[10px] text-slate-400">น้ำหนักดิบรวม: {metrics.goldWeight.toFixed(2)} กรัม</p>
                      </div>
                      <div className="text-right bg-white px-3 py-2 rounded-xl border border-amber-200/60">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">ต้นทุนถ่วงน้ำหนัก</p>
                        <p className="text-sm font-black text-slate-800 font-mono">฿{Math.round(metrics.rawGoldAvgCost).toLocaleString()}</p>
                        <p className="text-[9px] text-amber-700 font-medium">บาทละ (เนื้อแท้)</p>
                      </div>
                    </div>

                    <div className="p-5 bg-slate-100/60 rounded-2xl border border-slate-200 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-slate-700 uppercase">คลังเงินบริสุทธิ์ 99.99%</p>
                        <p className="text-xl font-black text-slate-800 mt-2 font-mono">{metrics.pureSilverGrams.toFixed(2)} กรัม</p>
                        <p className="text-[10px] text-slate-400">น้ำหนักรวมคลังชั่งจริงหลังหลอม</p>
                      </div>
                      <div className="text-right bg-white px-3 py-2 rounded-xl border border-slate-200">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">ต้นทุนถ่วงน้ำหนัก</p>
                        <p className="text-sm font-black text-slate-800 font-mono">฿{metrics.rawSilverAvgCost.toFixed(2)}</p>
                        <p className="text-[9px] text-slate-500 font-medium">ต่อกรัม (เนื้อแท้)</p>
                      </div>
                    </div>

                    <div className="p-5 bg-indigo-50/40 rounded-2xl border border-indigo-100 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-indigo-900 uppercase">คลังแพลตตินัมสะสม</p>
                        <p className="text-xl font-black text-slate-800 mt-2 font-mono">{metrics.purePlatinumGrams.toFixed(2)} กัม</p>
                        <p className="text-[10px] text-slate-400">น้ำหนักรวมโลหะแพลตตินัมในชีต</p>
                      </div>
                      <div className="text-right bg-white px-3 py-2 rounded-xl border border-indigo-100">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">ราคาตลาดรับซื้อเฉลี่ย</p>
                        <p className="text-sm font-black text-slate-800 font-mono">฿{Math.round(metrics.avgPlatinumMarketPrice).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* แผงที่ 3: สรุปรายได้สะสมจากค่าสกัด */}
                <div className="p-6 bg-white border border-slate-200/60 rounded-[2rem] shadow-xs space-y-4">
                  <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2">🧪 ผลรวมกำไรจากค่าสกัดหน้าตั๋วบิลซื้อ (ล็อกรายได้แล้ว)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-center">
                      <p className="text-[11px] font-medium text-slate-400 uppercase">ค่าสกัดทองคำสะสม</p>
                      <p className="text-lg font-bold text-slate-800 mt-1">฿{Math.round(metrics.goldFee).toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-center">
                      <p className="text-[11px] font-medium text-slate-400 uppercase">ค่าสกัดเงินสะสม</p>
                      <p className="text-lg font-bold text-slate-800 mt-1">฿{Math.round(metrics.silverFee).toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-center">
                      <p className="text-[11px] font-medium text-slate-400 uppercase">ค่าสกัดแพลตตินัมสะสม</p>
                      <p className="text-lg font-bold text-slate-800 mt-1">฿{Math.round(metrics.platinumFee).toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-indigo-600 text-white rounded-xl text-center shadow-xs">
                      <p className="text-[11px] font-semibold text-indigo-200 uppercase">รวมเงินค่าสกัดในกระเป๋า</p>
                      <p className="text-xl font-black mt-1 font-mono">฿{Math.round(metrics.totalFeeAll).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* แท็บที่ 2: TFEX */}
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
                            <td className="py-4 text-right">${livePrices.goldSpot.toLocaleString()}</td>
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

            {/* แท็บที่ 3: ระบบคัดสต็อกวิเคราะห์ล็อต */}
            {currentTab === 'reconciliation' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Batch Sale Analyzer</h1>
                    <p className="text-slate-500 text-sm mt-1">เลือกชิ้นงานหน้าร้านเพื่อจัดเตรียมล็อต คำนวณความบริสุทธิ์ถ่วงน้ำหนัก และจำลองเป้าหมายกำไรส่งขาย</p>
                  </div>
                  <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none font-bold text-slate-700">
                      <option value="All">🗓️ กรองคลังสินค้าทุกเดือน</option>
                      {uniqueMonths.map(m => (
                        <option key={m} value={m}>{formatThaiMonth(m)}</option>
                      ))}
                    </select>
                    <button onClick={fetchData} className="px-3 py-1 text-xs font-medium bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600 hover:bg-indigo-100 transition-colors">
                      🔄 รีเฟรชข้อมูลคลัง
                    </button>
                  </div>
                </div>

                {/* แผงวิเคราะห์ล็อตแยกตามกลุ่มสินค้า */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 bg-white border border-slate-200/60 rounded-[2rem] shadow-xs flex justify-between items-center relative overflow-hidden">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">สต็อกทองคำ</span>
                      <p className="text-[11px] font-medium text-slate-400 uppercase mt-2">ต้นทุนรับซื้อทองรวม</p>
                      <p className="text-2xl font-bold text-slate-800">฿{batch.goldCost.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400">ชั่งรวม: {batch.goldWeight.toFixed(2)} ก. | ค่าสกัด: ฿{batch.goldFee.toLocaleString()}</p>
                    </div>
                    <div className="text-right border-l border-slate-100 pl-4 h-full flex flex-col justify-center bg-slate-50/50 px-4 rounded-2xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ราคาตลาดเฉลี่ย</p>
                      <p className="text-lg font-black text-slate-700 mt-0.5">฿{Math.round(batch.avgGoldMarketPrice).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="p-6 bg-white border border-slate-200/60 rounded-[2rem] shadow-xs flex justify-between items-center relative overflow-hidden">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2.5 py-0.5 rounded-lg border border-amber-200">สต็อกเงิน</span>
                      <p className="text-[11px] font-medium text-slate-400 uppercase mt-2">ต้นทุนรับซื้อเงินรวม</p>
                      <p className="text-2xl font-bold text-slate-800">฿{batch.silverCost.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400">ชั่งรวม: {batch.silverWeight.toFixed(2)} ก. | ค่าสกัด: ฿{batch.silverFee.toLocaleString()}</p>
                    </div>
                    <div className="text-right border-l border-slate-100 pl-4 h-full flex flex-col justify-center bg-slate-50/50 px-4 rounded-2xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ราคาตลาดเฉลี่ย</p>
                      <p className="text-lg font-black text-slate-700 mt-0.5">฿{batch.avgSilverMarketPrice.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="p-6 bg-white border border-slate-200/60 rounded-[2rem] shadow-xs flex justify-between items-center relative overflow-hidden">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200">แพลตตินัม</span>
                      <p className="text-[11px] font-medium text-slate-400 uppercase mt-2">ต้นทุนรับซื้อแพลตตินัม</p>
                      <p className="text-2xl font-bold text-slate-800">฿{batch.platinumCost.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400">ชั่งรวม: {batch.platinumWeight.toFixed(2)} ก. | ค่าสกัด: ฿{batch.platinumFee.toLocaleString()}</p>
                    </div>
                    <div className="text-right border-l border-slate-100 pl-4 h-full flex flex-col justify-center bg-slate-50/50 px-4 rounded-2xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ราคาตลาดเฉลี่ย</p>
                      <p className="text-lg font-black text-slate-700 mt-0.5">฿{batch.avgPlatinumMarketPrice.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {/* แผงประเมินกำไร/ขาดทุนก่อนขายแบบแยกประเภท 2 เด้ง */}
                <div className="p-6 bg-slate-900 text-white border border-slate-800 rounded-[2rem] shadow-md space-y-6">
                  <div>
                    <h4 className="font-bold text-lg">📈 ประเมินสัญญาณกำไร/ขาดทุนก่อนขาย (Trading Signal)</h4>
                    <p className="text-xs text-slate-400 mt-0.5">แยกระหว่างกำไรค่าสกัด(ที่ได้แน่นอนแล้ว) กับ กำไรส่วนต่างราคา(ถ้ารอให้ราคาขึ้น)</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                    <div className="md:col-span-3 space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-amber-400/80 mb-1 uppercase">เป้าหมายราคาขายทอง (฿ / บาททองคำ)</label>
                        <input type="number" placeholder="เช่น 44500" value={targetPrices.goldSalePricePerBaht} onChange={(e) => setTargetPrices({...targetPrices, goldSalePricePerBaht: e.target.value})} className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 text-white rounded-xl focus:outline-none focus:border-amber-500 font-mono transition-colors" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">เป้าหมายราคาขายเงิน (฿ / กรัม)</label>
                        <input type="number" placeholder="เช่น 55" value={targetPrices.silverSalePricePerGram} onChange={(e) => setTargetPrices({...targetPrices, silverSalePricePerGram: e.target.value})} className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 text-white rounded-xl focus:outline-none focus:border-slate-400 font-mono transition-colors" />
                      </div>
                    </div>

                    <div className="md:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {batch.goldWeight > 0 && (
                        <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 shadow-inner">
                          <p className="text-amber-400 font-bold text-sm mb-3 border-b border-slate-700/80 pb-2">📊 วิเคราะห์กำไรล็อตทองคำ</p>
                          <div className="space-y-2.5 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">📉 กำไร/ขาดทุน จากส่วนต่างตลาด:</span>
                              <span className={`font-mono font-bold px-2 py-0.5 rounded-md ${batch.goldTradingPnL >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                {batch.goldTradingPnL >= 0 ? '+' : ''}฿{Math.round(batch.goldTradingPnL).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">🛡️ กำไรจากค่าสกัด (ได้แน่ๆ แล้ว):</span>
                              <span className="font-mono font-bold text-emerald-400">+฿{Math.round(batch.goldFee).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-700/50">
                              <span className="text-slate-200 font-semibold">กำไรสุทธิรวม (ทอง):</span>
                              <span className={`font-mono font-bold text-base ${batch.goldPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {batch.goldPnL >= 0 ? '+' : ''}฿{Math.round(batch.goldPnL).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {batch.silverWeight > 0 && (
                        <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 shadow-inner">
                          <p className="text-slate-300 font-bold text-sm mb-3 border-b border-slate-700/80 pb-2">📊 วิเคราะห์กำไรล็อตเงิน</p>
                          <div className="space-y-2.5 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">📉 กำไร/ขาดทุน จากส่วนต่างตลาด:</span>
                              <span className={`font-mono font-bold px-2 py-0.5 rounded-md ${batch.silverTradingPnL >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                {batch.silverTradingPnL >= 0 ? '+' : ''}฿{Math.round(batch.silverTradingPnL).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">🛡️ กำไรจากค่าสกัด (ได้แน่ๆ แล้ว):</span>
                              <span className="font-mono font-bold text-emerald-400">+฿{Math.round(batch.silverFee).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-700/50">
                              <span className="text-slate-200 font-semibold">กำไรสุทธิรวม (เงิน):</span>
                              <span className={`font-mono font-bold text-base ${batch.silverPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {batch.silverPnL >= 0 ? '+' : ''}฿{Math.round(batch.silverPnL).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-3 text-right p-5 bg-slate-800 border border-slate-700 rounded-2xl flex flex-col justify-center h-full">
                      <p className="text-xs font-medium text-slate-400 uppercase">รวมกำไรสุทธิทุกประเภท</p>
                      <p className={`text-3xl font-black mt-2 font-mono ${batch.totalPnLAll >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {batch.totalPnLAll >= 0 ? '+' : ''}฿{Math.round(batch.totalPnLAll).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ตารางคลังสินค้ารายชิ้น */}
                <div className="p-6 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800">เลือกชิ้นงานจากคลังระบบรับซื้อ (คัดกรองตามเดือนปัจจุบัน)</h3>
                    <button onClick={() => toggleSelectAll(sheetData.orderDetails.filter(d => selectedMonth === 'All' || getMonthYearStr(d.orderId) === selectedMonth.replace('-', '')))} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 transition-colors">
                      เลือกทั้งหมดในเดือนนี้
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-medium">
                          <th className="pb-3 text-center w-12">เลือก</th>
                          <th className="pb-3">รหัสบิล</th>
                          <th className="pb-3">ประเภทสินค้า</th>
                          <th className="pb-3 text-right">น้ำหนักก่อน (g)</th>
                          <th className="pb-3 text-right">น้ำหนักหลัง (g)</th>
                          <th className="pb-3 text-center">X-Ray Purity</th>
                          <th className="pb-3 text-right">ค่าสกัดที่หักไป</th>
                          <th className="pb-3 text-right">ยอดรับซื้อสุทธิ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {sheetData.orderDetails
                          .slice()
                          .reverse()
                          .filter(detail => {
                            if (selectedMonth === 'All') return true;
                            const orderYearMonth = detail.orderId.substring(0, 6);
                            const filterYearMonth = selectedMonth.replace('-', '');
                            return orderYearMonth === filterYearMonth;
                          })
                          .map((detail, idx) => {
                            const isChecked = !!selectedItems[`${detail.orderId}-${detail.itemNo}`];
                            return (
                              <tr key={idx} onClick={() => toggleItemSelection(detail.orderId, detail.itemNo)} className={`hover:bg-slate-50/70 cursor-pointer transition-colors ${isChecked ? 'bg-indigo-50/20' : ''}`}>
                                <td className="py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input type="checkbox" checked={isChecked} onChange={() => toggleItemSelection(detail.orderId, detail.itemNo)} className="w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                                </td>
                                <td className="py-4 font-mono text-xs text-slate-400 font-bold">{detail.orderId}</td>
                                <td className="py-4">
                                  <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${detail.itemType === 'ทอง' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-700'}`}>
                                    {detail.itemType}
                                  </span>
                                </td>
                                <td className="py-4 text-right">{detail.weightBefore} ก.</td>
                                <td className="py-4 text-right font-medium text-indigo-600">{detail.weightAfter} ก.</td>
                                <td className="py-4 text-center font-bold text-emerald-600">{detail.percent}%</td>
                                <td className="py-4 text-right text-slate-500 font-mono">฿{(detail.weightAfter * detail.fee).toLocaleString()}</td>
                                <td className="py-4 text-right font-bold text-slate-900 font-mono">฿{detail.itemTotal.toLocaleString()}</td>
                              </tr>
                            );
                          })}
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