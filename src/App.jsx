import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const API_URL = "https://script.google.com/macros/s/AKfycbzNV4EzBCmyu6VOwK8AMNEKtRMMPU9cz6h_IGxPRLcb4j5fwDttaVVWtgz5mM1UbzR/exec"; 
const GRAMS_PER_BAHT_9999 = 15.16;

const callApi = async (action, payload = {}) => {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action, payload })
    });
    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};

const safeNum = (val) => {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

const cleanStr = (val) => String(val || '').trim();

const cleanPhone = (val) => {
  if (!val) return '';
  let str = String(val).replace(/\D/g, ''); 
  if (str.length === 9 && !str.startsWith('0')) {
    str = '0' + str;
  }
  return str;
};

const formatShortLoc = (addr) => {
  if (!addr || addr === 'ไม่ระบุพื้นที่' || addr === 'ไม่ระบุ') return 'ไม่ระบุพื้นที่';
  const parts = addr.split(',');
  if (parts.length >= 2) {
    let p1 = parts[0].trim();
    let p2 = parts[1].trim();
    if (p2.includes('เมือง') && !p2.includes('อ.')) p2 = p2.replace('เมือง', 'อ.เมือง');
    return `${p1}, ${p2}`;
  }
  return addr.length > 20 ? addr.substring(0, 20) + '...' : addr;
};

const monthMap = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

const parseOrderDateInfo = (dateVal, orderId) => {
  const idStr = cleanStr(orderId);
  const newFmt = idStr.match(/^(\d{4})(\d{2})(\d{2})/);
  if (newFmt) {
    let yyyy = parseInt(newFmt[1]);
    if (yyyy > 2400) yyyy -= 543;
    return { yearMonth: `${yyyy}-${newFmt[2]}`, fullDate: `${yyyy}-${newFmt[2]}-${newFmt[3]}` };
  }
  const oldFmt = idStr.match(/^([a-zA-Z]{3})(\d{2})/);
  if (oldFmt) {
    const monName = oldFmt[1].toLowerCase();
    const mm = monthMap[monName] || '01';
    let yy = parseInt(oldFmt[2]);
    return { yearMonth: `${2000 + yy}-${mm}`, fullDate: `${2000 + yy}-${mm}-01` };
  }
  if (dateVal) {
    const str = String(dateVal).trim();
    const match = str.match(/(\d{4})[-/]?(\d{2})[-/]?(\d{2})?/);
    if (match) {
      let yyyy = parseInt(match[1]);
      if (yyyy > 2400) yyyy -= 543;
      return { yearMonth: `${yyyy}-${match[2]}`, fullDate: `${yyyy}-${match[2]}-${match[3] || '01'}` };
    }
  }
  return { yearMonth: '', fullDate: '' };
};

const PALETTE = {
  blue: '#2563eb',
  amber: '#f59e0b',
  navy: '#0f172a',
  emerald: '#10b981',
  rose: '#e11d48',
  slate: '#64748b'
};

const PIE_COLORS = ['#2563eb', '#f59e0b', '#10b981', '#0f172a', '#8b5cf6', '#e11d48'];

function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [sheetData, setSheetData] = useState({ 
    orders: [], orderDetails: [], stockOutRecords: [], members: [], expenses: [], metrics: { totalAssetValue: 0, totalOrdersCount: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendingLine, setSendingLine] = useState(false);

  const [viewLotDetail, setViewLotDetail] = useState(null);
  const [viewCustomerDetail, setViewCustomerDetail] = useState(null);

  const [viewMode, setViewMode] = useState('monthly'); 
  const [selectedMonth, setSelectedMonth] = useState('All'); 
  const [selectedDate, setSelectedDate] = useState(''); 

  const [itemTypeFilter, setItemTypeFilter] = useState('All');
  const [maxGoldPriceFilter, setMaxGoldPriceFilter] = useState('');
  const [maxSilverPriceFilter, setMaxSilverPriceFilter] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [crmSearch, setCrmSearch] = useState('');
  const [crmPage, setCrmPage] = useState(1);
  
  const [expensePage, setExpensePage] = useState(1);
  const EXPENSE_ITEMS_PER_PAGE = 10;
  const [expenseSearch, setExpenseSearch] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];
  const [expenseForm, setExpenseForm] = useState({
    date: todayStr, docType: 'ใบเสร็จรับเงิน', category: 'ค่าน้ำ / ค่าไฟฟ้า / อินเทอร์เน็ต',
    beforeVat: '', vatAmount: '', totalAmount: '', payer: 'แม่กบทอง', status: 'จ่ายแล้ว', notes: ''
  });

  const ITEMS_PER_PAGE = 15;
  const [initialBudget, setInitialBudget] = useState('2000000'); 
  const [selectedItems, setSelectedItems] = useState({});
  const [targetPrices, setTargetPrices] = useState({ goldSalePricePerBaht: '', silverSalePricePerGram: '' });

  // 🎯 ดึงข้อมูลแบบ GET ผ่าน URL Parameter เพื่อทะลวงผ่าน 302 Redirect ได้ 100%
  const fetchData = () => {
    setLoading(true);
    fetch(`${API_URL}?action=getDashboard`)
      .then(res => res.json())
      .then(result => {
        if (result && result.status === "success") {
          setSheetData({
            orders: Array.isArray(result.orders) ? result.orders : [],
            orderDetails: Array.isArray(result.orderDetails) ? result.orderDetails : [],
            stockOutRecords: Array.isArray(result.stockOutRecords) ? result.stockOutRecords : [],
            members: Array.isArray(result.members) ? result.members : [],
            expenses: Array.isArray(result.expenses) ? result.expenses : [],
            metrics: result.metrics || { totalAssetValue: 0, totalOrdersCount: 0 }
          });
          if (Array.isArray(result.orders) && result.orders.length > 0) {
            const lastOrder = result.orders[result.orders.length - 1];
            const parsed = parseOrderDateInfo(lastOrder.date, lastOrder.orderId);
            if (parsed.fullDate) setSelectedDate(parsed.fullDate);
          }
          setError(null);
        } else {
          setError(result?.message || "รูปแบบข้อมูลไม่ถูกต้อง");
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Fetch Error:", err);
        setError("ไม่สามารถเชื่อมต่อ Google Sheets ได้");
        setLoading(false);
      });
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    setCurrentPage(1); setHistoryPage(1); setCrmPage(1); setExpensePage(1);
  }, [selectedMonth, maxGoldPriceFilter, maxSilverPriceFilter, itemTypeFilter, viewMode, crmSearch, expenseSearch]);

  const formatThaiMonthShort = (monthStr) => {
    if (!monthStr || monthStr === 'All') return 'ทั้งหมด';
    const parts = monthStr.split('-');
    if (parts.length < 2) return monthStr;
    const [yyyy, mm] = parts;
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${months[safeNum(mm) - 1] || ''} ${String(safeNum(yyyy) + 543).substring(2)}`;
  };

  const formatThaiMonth = (monthStr) => {
    if (!monthStr || monthStr === 'All') return 'แสดงข้อมูลสะสมทั้งหมด';
    const parts = monthStr.split('-');
    if (parts.length < 2) return monthStr;
    const [yyyy, mm] = parts;
    const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    return `${months[safeNum(mm) - 1] || ''} ${safeNum(yyyy) + 543}`;
  };

  const formatThaiDate = (dateStr) => {
    if (!dateStr) return 'ไม่ได้เลือกวันที่';
    const onlyDate = dateStr.split(' ')[0];
    const parts = onlyDate.split('-');
    if (parts.length < 3) return dateStr;
    const [yyyy, mm, dd] = parts;
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${parseInt(dd)} ${months[parseInt(mm) - 1]} ${parseInt(yyyy) + 543}`;
  };

  const ordersList = Array.isArray(sheetData?.orders) ? sheetData.orders : [];
  const detailsList = Array.isArray(sheetData?.orderDetails) ? sheetData.orderDetails : [];
  const stockOutRecordsList = Array.isArray(sheetData?.stockOutRecords) ? sheetData.stockOutRecords : []; 
  const membersList = Array.isArray(sheetData?.members) ? sheetData.members : [];
  const expensesList = Array.isArray(sheetData?.expenses) ? sheetData.expenses : [];

  const uniqueMonths = Array.from(new Set(ordersList.map(o => parseOrderDateInfo(o?.date, o?.orderId).yearMonth).filter(Boolean))).sort().reverse();
  const uniqueDates = Array.from(new Set(ordersList.map(o => parseOrderDateInfo(o?.date, o?.orderId).fullDate).filter(Boolean))).sort().reverse();

  const historyUniqueMonths = Array.from(new Set(stockOutRecordsList.map(o => parseOrderDateInfo(o?.saleDate, o?.lotId).yearMonth).filter(Boolean))).sort().reverse();
  const historyUniqueDates = Array.from(new Set(stockOutRecordsList.map(o => parseOrderDateInfo(o?.saleDate, o?.lotId).fullDate).filter(Boolean))).sort().reverse();

  const displayMonths = currentTab === 'history' ? historyUniqueMonths : uniqueMonths;
  const displayDates = currentTab === 'history' ? historyUniqueDates : uniqueDates;

  const monthlyChartData = uniqueMonths.map(m => {
    const total = ordersList
      .filter(o => parseOrderDateInfo(o?.date, o?.orderId).yearMonth === m)
      .reduce((sum, o) => sum + safeNum(o.grandTotal), 0);
    return { name: formatThaiMonthShort(m), "ยอดรับซื้อ": total };
  }).reverse();

  const filteredExpensesList = expensesList.slice().reverse().filter(exp => {
    if (!exp || !exp.date) return false;
    const dateInfo = parseOrderDateInfo(exp.date, null);
    if (viewMode === 'daily') {
      return dateInfo.fullDate === selectedDate;
    } else {
      return selectedMonth === 'All' || dateInfo.yearMonth === selectedMonth;
    }
  });

  const totalActualExpenses = filteredExpensesList.reduce((sum, exp) => sum + safeNum(exp.totalAmount), 0);
  const totalClaimableVat = filteredExpensesList.filter(exp => exp.docType === 'ใบกำกับภาษี/ใบเสร็จรับเงิน').reduce((sum, exp) => sum + safeNum(exp.vatAmount), 0);

  const getDashboardMetrics = () => {
    let monthlyPurchases = 0;
    let uniqueOrders = new Set();
    let goldWeight = 0, goldPuritySum = 0, goldCost = 0, goldFee = 0, goldMarketPriceSum = 0;
    let silverWeight = 0, silverPuritySum = 0, silverCost = 0, silverFee = 0, silverMarketPriceSum = 0;
    let selectedCount = 0;

    const soldItemKeys = new Set();
    stockOutRecordsList.forEach(record => {
      (record.itemsDetail || []).forEach(key => soldItemKeys.add(key));
    });

    ordersList.forEach(order => {
      if (!order) return;
      const dateInfo = parseOrderDateInfo(order.date, order.orderId);
      const isMatch = viewMode === 'daily' ? dateInfo.fullDate === selectedDate : (selectedMonth === 'All' || dateInfo.yearMonth === selectedMonth);
      if (isMatch) {
        monthlyPurchases += safeNum(order.grandTotal);
        if (order.orderId) uniqueOrders.add(cleanStr(order.orderId));
      }
    });

    detailsList.forEach(item => {
      if (!item) return;
      const key = `${cleanStr(item.orderId)}-${item.itemNo}`;
      if (soldItemKeys.has(key) && currentTab !== 'reconciliation') return;

      const isInclude = currentTab === 'reconciliation'
        ? !!selectedItems[key]
        : (viewMode === 'daily'
            ? parseOrderDateInfo(null, item.orderId).fullDate === selectedDate
            : (selectedMonth === 'All' || parseOrderDateInfo(null, item.orderId).yearMonth === selectedMonth));

      if (isInclude) {
        selectedCount++;
        const weightAfter = safeNum(item.weightAfter);
        const fee = safeNum(item.fee);
        const percent = safeNum(item.percent);
        const itemTotal = safeNum(item.itemTotal);
        const marketPrice = safeNum(item.marketPrice);
        const itemFeeTotal = weightAfter * fee;

        if (item.itemType === 'ทอง') {
          goldWeight += weightAfter; goldPuritySum += (weightAfter * percent);
          goldCost += itemTotal; goldFee += itemFeeTotal; goldMarketPriceSum += (weightAfter * marketPrice);
        } else if (item.itemType === 'เงิน') {
          silverWeight += weightAfter; silverPuritySum += (weightAfter * percent);
          silverCost += itemTotal; silverFee += itemFeeTotal; silverMarketPriceSum += (weightAfter * marketPrice);
        }
      }
    });

    const avgGoldPurity = goldWeight > 0 ? (goldPuritySum / goldWeight) : 0;
    const avgSilverPurity = silverWeight > 0 ? (silverPuritySum / silverWeight) : 0;
    const pureGoldBaht = (goldWeight * (avgGoldPurity / 100)) / GRAMS_PER_BAHT_9999;
    const pureSilverGrams = silverWeight * (avgSilverPurity / 100);
    const rawGoldAvgCost = pureGoldBaht > 0 ? (goldCost / pureGoldBaht) : 0;
    const rawSilverAvgCost = pureSilverGrams > 0 ? (silverCost / pureSilverGrams) : 0;

    const gSalePrice = safeNum(targetPrices.goldSalePricePerBaht);
    const goldPnL = gSalePrice > 0 ? ((pureGoldBaht * gSalePrice) - goldCost) : 0;
    const goldTradingPnL = goldPnL !== 0 ? (goldPnL - goldFee) : 0;

    const sSalePrice = safeNum(targetPrices.silverSalePricePerGram);
    const silverPnL = sSalePrice > 0 ? ((pureSilverGrams * sSalePrice) - silverCost) : 0;
    const silverTradingPnL = silverPnL !== 0 ? (silverPnL - silverFee) : 0;

    const cashBalance = safeNum(initialBudget) - monthlyPurchases - totalActualExpenses;
    const inventoryPieData = [{ name: 'ทองคำ', value: goldCost, color: PALETTE.amber }, { name: 'เงิน', value: silverCost, color: PALETTE.slate }].filter(d => d.value > 0);

    return {
      monthlyPurchases, customersCount: uniqueOrders.size, selectedCount, soldItemKeys,
      goldWeight, pureGoldBaht, goldCost, goldFee, goldTradingPnL, goldPnL, rawGoldAvgCost, avgGoldMarketPrice: goldWeight > 0 ? (goldMarketPriceSum / goldWeight) : 0,
      silverWeight, pureSilverGrams, silverCost, silverFee, silverTradingPnL, silverPnL, rawSilverAvgCost, avgSilverMarketPrice: silverWeight > 0 ? (silverMarketPriceSum / silverWeight) : 0,
      totalCostAll: goldCost + silverCost, totalFeeAll: goldFee + silverFee, totalTradingPnLAll: goldTradingPnL + silverTradingPnL, totalPnLAll: goldPnL + silverPnL, cashBalance, inventoryPieData
    };
  };

  const metrics = getDashboardMetrics();
  const batch = getDashboardMetrics(); 

  const filteredDetailsList = detailsList.slice().reverse().filter(detail => {
      if (!detail || !detail.orderId) return false;
      const key = `${cleanStr(detail.orderId)}-${detail.itemNo}`;
      if (metrics.soldItemKeys.has(key)) return false;
      if (detail.itemType !== 'ทอง' && detail.itemType !== 'เงิน') return false;
      if (itemTypeFilter !== 'All' && detail.itemType !== itemTypeFilter) return false;
      if (selectedMonth !== 'All' && parseOrderDateInfo(null, detail.orderId).yearMonth !== selectedMonth) return false;
      if (detail.itemType === 'ทอง' && maxGoldPriceFilter !== '' && safeNum(detail.marketPrice) > safeNum(maxGoldPriceFilter)) return false;
      if (detail.itemType === 'เงิน' && maxSilverPriceFilter !== '' && safeNum(detail.marketPrice) > safeNum(maxSilverPriceFilter)) return false;
      return true;
  });

  const totalPages = Math.ceil(filteredDetailsList.length / ITEMS_PER_PAGE) || 1;
  const paginatedDetailsList = filteredDetailsList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const filteredStockOutRecords = stockOutRecordsList.slice().reverse().filter(record => {
      if (!record || !record.lotId) return false;
      const dateInfo = parseOrderDateInfo(record.saleDate, record.lotId);
      return viewMode === 'daily' ? dateInfo.fullDate === selectedDate : (selectedMonth === 'All' || dateInfo.yearMonth === selectedMonth);
  });

  const historyTotalPages = Math.ceil(filteredStockOutRecords.length / ITEMS_PER_PAGE) || 1;
  const paginatedHistoryList = filteredStockOutRecords.slice((historyPage - 1) * ITEMS_PER_PAGE, historyPage * ITEMS_PER_PAGE);

  const historySummary = filteredStockOutRecords.reduce((acc, curr) => {
    acc.totalCost += safeNum(curr.totalCost); acc.totalFee += safeNum(curr.totalFee);
    acc.totalTradingPnL += safeNum(curr.totalTradingPnL); acc.netProfitRealized += safeNum(curr.netProfitRealized);
    acc.totalRevenue += safeNum(curr.totalCost) + safeNum(curr.netProfitRealized);
    return acc;
  }, { totalCost: 0, totalFee: 0, totalTradingPnL: 0, netProfitRealized: 0, totalRevenue: 0 });

  const trueNetProfit = historySummary.netProfitRealized - totalActualExpenses;

  // CRM Logic
  const memberMapByPhone = {};
  const memberMapByName = {};
  membersList.forEach(m => {
    if (!m) return;
    const p = cleanPhone(m.phone);
    const n = cleanStr(m.name).toLowerCase();
    if (p) memberMapByPhone[p] = m;
    if (n) memberMapByName[n] = m;
  });

  const customerMap = {};
  let areaCounts = {};

  ordersList.forEach(o => {
    if (!o) return;
    const rawPhone = cleanPhone(o.phone);
    const rawName = cleanStr(o.customerName);
    const memberInfo = (rawPhone && memberMapByPhone[rawPhone]) || (rawName && memberMapByName[rawName.toLowerCase()]) || {};
    const primaryKey = rawPhone || (rawName ? `NAME:${rawName}` : 'ไม่ระบุตัวตน');

    if (!customerMap[primaryKey]) {
      customerMap[primaryKey] = {
        phone: rawPhone || (memberInfo.phone ? cleanPhone(memberInfo.phone) : 'ไม่ระบุเบอร์โทร'),
        name: memberInfo.name || rawName || 'ไม่ระบุชื่อ',
        age: safeNum(memberInfo.age),
        source: memberInfo.source || o.source || 'ไม่ระบุช่องทาง',
        nationality: memberInfo.nationality || 'ไทย',
        address: memberInfo.address || o.address || 'ไม่ระบุพื้นที่',
        visits: 0,
        totalSpent: 0,
        lastVisit: o.date,
        orderIds: []
      };
      const shortAddr = formatShortLoc(customerMap[primaryKey].address);
      areaCounts[shortAddr] = (areaCounts[shortAddr] || 0) + 1;
    }
    customerMap[primaryKey].visits += 1;
    customerMap[primaryKey].totalSpent += safeNum(o.grandTotal);
    customerMap[primaryKey].orderIds.push(o.orderId);
    if (o.date >= customerMap[primaryKey].lastVisit) customerMap[primaryKey].lastVisit = o.date;
  });

  const allCustomers = Object.values(customerMap).sort((a, b) => b.totalSpent - a.totalSpent);
  const sortedAreas = Object.keys(areaCounts).map(k => ({ name: k, count: areaCounts[k] })).sort((a, b) => b.count - a.count);
  const top5Areas = sortedAreas.slice(0, 5);

  let ageGroups = { '< 25 ปี': 0, '25-40 ปี': 0, '41-60 ปี': 0, '> 60 ปี': 0, 'ไม่ระบุ': 0 };
  let sourceCounts = {};
  let totalReturnCustomers = 0;

  allCustomers.forEach(c => {
    if (c.visits > 1) totalReturnCustomers++;
    if (c.age > 0 && c.age < 25) ageGroups['< 25 ปี']++;
    else if (c.age >= 25 && c.age <= 40) ageGroups['25-40 ปี']++;
    else if (c.age >= 41 && c.age <= 60) ageGroups['41-60 ปี']++;
    else if (c.age > 60) ageGroups['> 60 ปี']++;
    else ageGroups['ไม่ระบุ']++;

    const src = c.source || 'ไม่ระบุ';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });

  const sourceChartData = Object.keys(sourceCounts).map(k => ({ name: k, value: sourceCounts[k] })).filter(d => d.value > 0);
  const ageChartData = Object.keys(ageGroups).map(k => ({ name: k, value: ageGroups[k] })).filter(d => d.value > 0);
  const returnRatePercent = allCustomers.length > 0 ? Math.round((totalReturnCustomers / allCustomers.length) * 100) : 0;
  const topVIPs = allCustomers.slice(0, 3);

  const filteredCustomers = allCustomers.filter(c => 
    c.name.toLowerCase().includes(crmSearch.toLowerCase()) || 
    c.phone.includes(crmSearch) || 
    formatShortLoc(c.address).toLowerCase().includes(crmSearch.toLowerCase())
  );
  const crmTotalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE) || 1;
  const paginatedCustomers = filteredCustomers.slice((crmPage - 1) * ITEMS_PER_PAGE, crmPage * ITEMS_PER_PAGE);

  const searchedExpenses = filteredExpensesList.filter(exp => 
    exp.category.toLowerCase().includes(expenseSearch.toLowerCase()) ||
    exp.notes.toLowerCase().includes(expenseSearch.toLowerCase()) ||
    exp.docType.toLowerCase().includes(expenseSearch.toLowerCase()) ||
    exp.payer.toLowerCase().includes(expenseSearch.toLowerCase())
  );
  const expenseTotalPages = Math.ceil(searchedExpenses.length / EXPENSE_ITEMS_PER_PAGE) || 1;
  const paginatedExpenses = searchedExpenses.slice((expensePage - 1) * EXPENSE_ITEMS_PER_PAGE, expensePage * EXPENSE_ITEMS_PER_PAGE);

  const expCatMap = {};
  filteredExpensesList.forEach(exp => {
    expCatMap[exp.category] = (expCatMap[exp.category] || 0) + safeNum(exp.totalAmount);
  });
  const expCatPieData = Object.keys(expCatMap).map(cat => ({ name: cat, value: expCatMap[cat] })).filter(d => d.value > 0);

  const handleExpenseTotalChange = (val) => {
    const tot = safeNum(val);
    if (expenseForm.docType === 'ใบกำกับภาษี/ใบเสร็จรับเงิน' && tot > 0) {
      const bVat = Math.round((tot / 1.07) * 100) / 100;
      const vAmt = Math.round((tot - bVat) * 100) / 100;
      setExpenseForm(prev => ({ ...prev, totalAmount: val, beforeVat: bVat, vatAmount: vAmt }));
    } else {
      setExpenseForm(prev => ({ ...prev, totalAmount: val, beforeVat: val, vatAmount: 0 }));
    }
  };

  const handlePayerChange = (newPayer) => {
    let autoStatus = 'จ่ายแล้ว';
    if (['อู', 'ออม', 'กบ'].includes(newPayer)) {
      autoStatus = 'รอจ่ายคืน';
    }
    setExpenseForm(prev => ({ ...prev, payer: newPayer, status: autoStatus }));
  };

  const handleSendLineReport = async () => {
    if (!confirm("ยืนยันการส่งรายงานสรุปยอดประจำวันเข้า LINE?")) return;
    setSendingLine(true);
    try {
      const res = await callApi('sendLineReport');
      if (res.status === 'success') {
        alert("ส่งรายงานสรุปยอดเข้า LINE เรียบร้อยแล้ว!");
      } else {
        alert(`เกิดข้อผิดพลาด: ${res.message}`);
      }
    } catch (err) {
      alert("ไม่สามารถยิงข้อความเข้า LINE ได้");
    } finally {
      setSendingLine(false);
    }
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.totalAmount || safeNum(expenseForm.totalAmount) <= 0) {
      return alert("กรุณาระบุจำนวนเงินค่าใช้จ่าย");
    }

    setSubmitting(true);
    try {
      const res = await callApi('saveExpense', expenseForm);
      if (res.status === 'success') {
        alert("บันทึกรายการค่าใช้จ่ายสำเร็จ!");
        setExpenseForm({
          date: todayStr, docType: 'ใบเสร็จรับเงิน', category: 'ค่าน้ำ / ค่าไฟฟ้า / อินเทอร์เน็ต',
          beforeVat: '', vatAmount: '', totalAmount: '', payer: 'แม่กบทอง', status: 'จ่ายแล้ว', notes: ''
        });
        fetchData();
      } else {
        alert(`เกิดข้อผิดพลาด: ${res.message}`);
      }
    } catch (err) {
      alert("ไม่สามารถเชื่อมต่อบันทึกข้อมูลได้");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!confirm("ยืนยันการลบรายการค่าใช้จ่ายนี้?")) return;
    setSubmitting(true);
    try {
      const res = await callApi('deleteExpense', { expenseId });
      if (res.status === 'success') {
        alert("ลบรายการค่าใช้จ่ายเรียบร้อยแล้ว");
        fetchData();
      } else {
        alert(`เกิดข้อผิดพลาด: ${res.message}`);
      }
    } catch (err) {
      alert("ไม่สามารถเชื่อมต่อลบข้อมูลได้");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleExpenseStatus = async (expenseId, currentStatus) => {
    const newStatus = (currentStatus === 'รอจ่ายคืน') ? 'จ่ายคืนแล้ว' : 'รอจ่ายคืน';
    setSubmitting(true);
    try {
      const res = await callApi('toggleExpenseStatus', { expenseId, newStatus });
      if (res.status === 'success') {
        fetchData();
      } else {
        alert(`เกิดข้อผิดพลาด: ${res.message}`);
      }
    } catch (err) {
      alert("ไม่สามารถเปลี่ยนสถานะได้");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleItemSelection = (orderId, itemNo) => {
    const key = `${cleanStr(orderId)}-${itemNo}`;
    setSelectedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSelectAllFiltered = () => {
    const allSelected = filteredDetailsList.every(item => selectedItems[`${cleanStr(item.orderId)}-${item.itemNo}`]);
    const newSelections = { ...selectedItems };
    filteredDetailsList.forEach(item => { newSelections[`${cleanStr(item.orderId)}-${item.itemNo}`] = !allSelected; });
    setSelectedItems(newSelections);
  };

  // 🖨️ ฟังก์ชันพิมพ์ใบหาของในตู้เซฟ (A4 แนวนอน Landscape)
  const handlePrintSelected = () => {
    const selectedList = detailsList.filter(item => {
      const key = `${cleanStr(item.orderId)}-${item.itemNo}`;
      return !!selectedItems[key] && !metrics.soldItemKeys.has(key);
    });

    if (selectedList.length === 0) {
      alert("กรุณาติ๊กเลือกชิ้นงานที่ต้องการพิมพ์อย่างน้อย 1 รายการครับ");
      return;
    }

    let totalGoldW = 0;
    let totalSilverW = 0;
    let totalSum = 0;

    selectedList.forEach(item => {
      const w = safeNum(item.weightAfter);
      const tot = safeNum(item.itemTotal);
      if (item.itemType === 'ทอง') totalGoldW += w;
      if (item.itemType === 'เงิน') totalSilverW += w;
      totalSum += tot;
    });

    const nowStr = new Date().toLocaleString('th-TH');
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      alert("กรุณาอนุญาตให้เปิด Pop-up บนเบราว์เซอร์เพื่อพิมพ์เอกสารครับ");
      return;
    }

    const rowsHtml = selectedList.map((item, index) => `
      <tr style="border-bottom: 1px solid #cbd5e1; text-align: center; height: 38px;">
        <td style="border: 1px solid #cbd5e1; width: 45px;"><div style="width: 15px; height: 15px; border: 1.5px solid #475569; margin: auto; border-radius: 3px;"></div></td>
        <td style="border: 1px solid #cbd5e1; font-weight: bold;">${index + 1}</td>
        <td style="border: 1px solid #cbd5e1; font-family: sans-serif; font-weight: 600;">${item.orderId}</td>
        <td style="border: 1px solid #cbd5e1; font-weight: bold; color: ${item.itemType === 'ทอง' ? '#b45309' : '#334155'};">${item.itemType}</td>
        <td style="border: 1px solid #cbd5e1; text-align: right; padding-right: 12px; font-weight: bold; color: #2563eb;">${safeNum(item.weightAfter).toFixed(2)} g</td>
        <td style="border: 1px solid #cbd5e1; font-weight: bold; color: #059669;">${safeNum(item.percent)}%</td>
        <td style="border: 1px solid #cbd5e1; text-align: right; padding-right: 12px;">฿${safeNum(item.marketPrice).toLocaleString()}</td>
        <td style="border: 1px solid #cbd5e1; text-align: right; padding-right: 12px; font-weight: bold;">฿${safeNum(item.itemTotal).toLocaleString()}</td>
        <td style="border: 1px solid #cbd5e1; text-align: left; padding-left: 8px;"></td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>ใบสั่งจัดสินค้าในตู้เซฟ - ร้านแม่กบทอง</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body { font-family: 'Sarabun', 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 12px; color: #0f172a; font-size: 13px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
          .title { font-size: 20px; font-weight: bold; color: #0f172a; }
          .subtitle { font-size: 12px; color: #475569; }
          .summary-box { display: flex; gap: 24px; margin-bottom: 12px; background: #f8fafc; padding: 10px 16px; border-radius: 8px; border: 1px solid #cbd5e1; }
          .summary-item { font-size: 13px; }
          .summary-item strong { color: #0f172a; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 5px; }
          th { background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; color: #334155; }
          td { padding: 4px; font-size: 12px; }
          .footer { margin-top: 25px; display: flex; justify-content: space-between; font-size: 12px; color: #475569; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">🏆 ร้านแม่กบทอง — ใบสั่งจัดสินค้าในตู้เซฟ (Pick List)</div>
            <div class="subtitle">ใช้สำหรับเดินตรวจเช็กและหยิบสินค้าในตู้เซฟเพื่อตัดสต็อกส่งขาย</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: bold; font-size: 13px;">วันที่พิมพ์: ${nowStr}</div>
            <div style="font-size: 13px; color: #2563eb; font-weight: bold; margin-top: 2px;">จำนวนรายการที่เลือก: ${selectedList.length} ชิ้น</div>
          </div>
        </div>

        <div class="summary-box">
          <div class="summary-item">น้ำหนักทองคำรวม: <strong style="color: #b45309;">${totalGoldW.toFixed(2)} กรัม</strong></div>
          <div class="summary-item">น้ำหนักเงินรวม: <strong style="color: #475569;">${totalSilverW.toFixed(2)} กรัม</strong></div>
          <div class="summary-item">มูลค่ารับซื้อสุทธิรวม: <strong style="color: #2563eb;">฿${Math.round(totalSum).toLocaleString()}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 45px;">เช็ก</th>
              <th style="width: 45px;">ลำดับ</th>
              <th style="width: 140px;">รหัสบิล (OrderID)</th>
              <th style="width: 80px;">ประเภท</th>
              <th style="width: 110px;">น้ำหนัก (g)</th>
              <th style="width: 90px;">X-Ray %</th>
              <th style="width: 110px;">ราคาตลาด</th>
              <th style="width: 120px;">รับซื้อสุทธิ</th>
              <th>หมายเหตุ / ตำแหน่งจัดเก็บ</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer">
          <div>ผู้พิมพ์รายการ: ...........................................................</div>
          <div>ผู้จัดเตรียมของในตู้เซฟ: ...........................................................</div>
          <div>ผู้ตรวจสอบสินค้า: ...........................................................</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleConfirmStockOut = async () => {
    if (batch.selectedCount === 0) return alert("กรุณาติ๊กเลือกชิ้นงานอย่างน้อย 1 รายการเพื่อตัดขาย");
    if (!confirm(`ยืนยันบันทึกตัดขายล็อตนี้จำนวน ${batch.selectedCount} รายการ?\n\nยอดกำไรสุทธิจริง: ฿${Math.round(batch.totalPnLAll).toLocaleString()}`)) return;
    
    setSubmitting(true);
    const payload = {
      selectedCount: batch.selectedCount, goldWeight: batch.goldWeight, silverWeight: batch.silverWeight,
      goldSalePrice: safeNum(targetPrices.goldSalePricePerBaht), silverSalePrice: safeNum(targetPrices.silverSalePricePerGram),
      totalCost: batch.totalCostAll, totalFee: batch.totalFeeAll, totalTradingPnL: batch.totalTradingPnLAll,
      netProfitRealized: batch.totalPnLAll, itemKeys: Object.keys(selectedItems).filter(k => selectedItems[k])
    };

    try {
      const res = await callApi('saveStockOut', payload);
      if (res.status === 'success') { 
        alert(`บันทึกตัดสต็อกส่งขายสำเร็จ!\nรหัสล็อต: ${res.lotId}`); 
        setSelectedItems({}); 
        fetchData(); 
      } else { 
        alert(`เกิดข้อผิดพลาด: ${res.message}`); 
      }
    } catch (err) {
      alert("ไม่สามารถเชื่อมต่อบันทึกข้อมูลได้");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f6f2] text-slate-900 font-sans antialiased relative">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap');
        @import url('https://fonts.cdnfonts.com/css/google-sans');

        * {
          font-family: 'Google Sans', 'Sarabun', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .font-num {
          font-family: 'Google Sans', sans-serif;
        }
      `}</style>

      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-slate-200/80 px-8 py-3.5 flex justify-between items-center shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-3.5 h-3.5 rounded-full bg-blue-600"></div>
          <span className="text-base font-bold tracking-tight text-slate-900">แม่กบทอง HQ</span>
        </div>
        
        <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 overflow-x-auto text-xs font-semibold">
          <button onClick={() => setCurrentTab('dashboard')} className={`px-4 py-2 whitespace-nowrap rounded-lg transition-all ${currentTab === 'dashboard' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-900'}`}>ภาพรวม</button>
          <button onClick={() => setCurrentTab('crm')} className={`px-4 py-2 whitespace-nowrap rounded-lg transition-all ${currentTab === 'crm' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-500 hover:text-slate-900'}`}>ข้อมูลลูกค้า (CRM)</button>
          <button onClick={() => setCurrentTab('reconciliation')} className={`px-4 py-2 whitespace-nowrap rounded-lg transition-all ${currentTab === 'reconciliation' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-900'}`}>ตัดสต็อกส่งขาย</button>
          <button onClick={() => setCurrentTab('history')} className={`px-4 py-2 whitespace-nowrap rounded-lg transition-all ${currentTab === 'history' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-900'}`}>ประวัติส่งขาย</button>
          <button onClick={() => setCurrentTab('expenses')} className={`px-4 py-2 whitespace-nowrap rounded-lg transition-all ${currentTab === 'expenses' ? 'bg-amber-500 text-white shadow-xs font-bold' : 'text-slate-500 hover:text-slate-900'}`}>รายจ่ายร้าน</button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 md:p-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 space-y-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 text-xs font-medium">กำลังโหลดข้อมูลระบบ...</p>
          </div>
        )}

        {!loading && error && (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center max-w-xl mx-auto mt-12">
            <p className="text-rose-700 font-bold text-sm">ไม่สามารถเชื่อมต่อฐานข้อมูลได้</p>
            <p className="text-rose-500 text-xs mt-1 font-mono break-all">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {(currentTab === 'dashboard' || currentTab === 'reconciliation' || currentTab === 'history' || currentTab === 'expenses') && (
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    {currentTab === 'dashboard' && 'ภาพรวมทางการเงินและการรับซื้อ'}
                    {currentTab === 'reconciliation' && 'คำนวณและตัดสต็อกส่งขาย'}
                    {currentTab === 'history' && 'ประวัติการส่งขายและกำไร'}
                    {currentTab === 'expenses' && 'จัดการรายจ่ายและกระแสเงินสด'}
                  </h1>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {currentTab === 'dashboard' && (
                    <button 
                      onClick={handleSendLineReport}
                      disabled={sendingLine}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                      {sendingLine ? 'กำลังส่ง...' : 'ส่งสรุปเข้า LINE'}
                    </button>
                  )}

                  <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                    <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
                      <button onClick={() => setViewMode('monthly')} className={`px-2.5 py-1 rounded-md transition-all ${viewMode === 'monthly' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-slate-500'}`}>รายเดือน</button>
                      <button onClick={() => setViewMode('daily')} className={`px-2.5 py-1 rounded-md transition-all ${viewMode === 'daily' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-slate-500'}`}>รายวัน</button>
                    </div>

                    {viewMode === 'monthly' ? (
                      <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 cursor-pointer">
                        <option value="All">ยอดสะสมทั้งหมด</option>
                        {displayMonths.map(m => (<option key={m} value={m}>{formatThaiMonth(m)}</option>))}
                      </select>
                    ) : (
                      <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 cursor-pointer">
                        {displayDates.map(d => (<option key={d} value={d}>วัน {formatThaiDate(d)}</option>))}
                      </select>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 1: DASHBOARD */}
            {currentTab === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-5 bg-[#0f172a] text-white rounded-2xl shadow-sm space-y-1">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{viewMode === 'daily' ? `ยอดรับซื้อประจำวัน` : `ยอดรับซื้อสะสม`}</p>
                    <p className="text-2xl font-bold font-num">฿{safeNum(metrics.monthlyPurchases).toLocaleString()}</p>
                  </div>

                  <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-1">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">จำนวนรายการบิล</p>
                    <p className="text-2xl font-bold text-blue-600 font-num">{metrics.customersCount} <span className="text-xs text-slate-500 font-normal">รายการ</span></p>
                  </div>

                  <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-1">
                    <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider">ตั้งงบทุนหมุนเวียน</label>
                    <input type="number" value={initialBudget} onChange={(e) => setInitialBudget(e.target.value)} className="w-full text-xl font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-slate-800 font-num focus:outline-none focus:border-blue-500" />
                  </div>

                  <div className={`p-5 rounded-2xl shadow-2xs space-y-1 border ${metrics.cashBalance < 200000 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-emerald-50/60 border-emerald-200/80 text-emerald-900'}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider">กระแสเงินสดคงเหลือ</p>
                    <p className="text-2xl font-bold font-num">฿{safeNum(metrics.cashBalance).toLocaleString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">แนวโน้มยอดเงินรับซื้อรายเดือน</h3>
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyChartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `฿${(val/1000).toFixed(0)}k`} />
                          <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(val) => [`฿${val.toLocaleString()}`, 'ยอดรับซื้อ']} />
                          <Bar dataKey="ยอดรับซื้อ" fill={PALETTE.blue} radius={[4, 4, 0, 0]} barSize={36} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">สัดส่วนเม็ดเงินทุนแยกประเภท</h3>
                    <div className="h-56 w-full">
                      {metrics.inventoryPieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={metrics.inventoryPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value">
                              {metrics.inventoryPieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                            </Pie>
                            <Tooltip formatter={(val) => `฿${val.toLocaleString()}`} />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (<div className="h-full flex items-center justify-center text-slate-400 text-xs">ไม่มีข้อมูลคลังสินค้า</div>)}
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-4">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">ทองคำและเงินในตู้เซฟ (ยังไม่ได้ขาย)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/60 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">ทองคำ 99.99%</span>
                        <p className="text-2xl font-bold text-slate-800 mt-2 font-num">{safeNum(metrics.pureGoldBaht).toFixed(2)} <span className="text-xs font-normal">บาททอง</span></p>
                        <p className="text-xs text-slate-500 mt-0.5">น้ำหนักดิบรวม: {safeNum(metrics.goldWeight).toFixed(2)} กรัม</p>
                      </div>
                      <div className="text-right bg-white px-3.5 py-2.5 rounded-lg border border-amber-200/80">
                        <p className="text-[10px] font-medium text-slate-400">ต้นทุนเฉลี่ย</p>
                        <p className="text-base font-bold text-slate-800 font-num">฿{Math.round(safeNum(metrics.rawGoldAvgCost)).toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded">เงินบริสุทธิ์ 99.99%</span>
                        <p className="text-2xl font-bold text-slate-800 mt-2 font-num">{safeNum(metrics.pureSilverGrams).toFixed(2)} <span className="text-xs font-normal">กรัม</span></p>
                        <p className="text-xs text-slate-500 mt-0.5">น้ำหนักดิบรวม: {safeNum(metrics.silverWeight).toFixed(2)} กรัม</p>
                      </div>
                      <div className="text-right bg-white px-3.5 py-2.5 rounded-lg border border-slate-200">
                        <p className="text-[10px] font-medium text-slate-400">ต้นทุนเฉลี่ย</p>
                        <p className="text-base font-bold text-slate-800 font-num">฿{safeNum(metrics.rawSilverAvgCost).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">ผลรวมค่าสกัดที่รอเปลี่ยนเป็นกำไร</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                      <p className="text-[10px] font-medium text-slate-400 uppercase">ค่าสกัดทองคำ</p>
                      <p className="text-base font-bold text-slate-800 mt-1 font-num">฿{Math.round(safeNum(metrics.goldFee)).toLocaleString()}</p>
                    </div>
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                      <p className="text-[10px] font-medium text-slate-400 uppercase">ค่าสกัดเงิน</p>
                      <p className="text-base font-bold text-slate-800 mt-1 font-num">฿{Math.round(safeNum(metrics.silverFee)).toLocaleString()}</p>
                    </div>
                    <div className="p-3.5 bg-blue-50 text-blue-900 rounded-xl text-center border border-blue-100">
                      <p className="text-[10px] font-semibold uppercase">รวมเงินค่าสกัดที่รอขาย</p>
                      <p className="text-lg font-bold mt-1 font-num">฿{Math.round(safeNum(metrics.totalFeeAll)).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-[#0f172a] text-white rounded-2xl shadow-md flex flex-col md:flex-row justify-between items-center gap-4">
                  <div>
                    <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 font-bold text-[10px] rounded border border-blue-400/30 uppercase tracking-wider">
                      Executive Summary
                    </span>
                    <h2 className="text-xl font-bold mt-1">กำไรสุทธิแท้จริงของร้าน (True Net Profit)</h2>
                    <p className="text-slate-400 text-xs">คำนวณจาก กำไรที่ส่งขายจริง หักด้วย ค่าใช้จ่ายการดำเนินงานหน้าร้านทั้งหมด</p>
                  </div>
                  <div className="text-center md:text-right bg-white/10 px-6 py-4 rounded-xl border border-white/10 min-w-[240px]">
                    <p className="text-[10px] font-medium text-slate-300 uppercase tracking-wider">ยอดกำไรสุทธิคงเหลือจริง</p>
                    <p className={`text-3xl font-bold font-num mt-0.5 ${trueNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {trueNetProfit >= 0 ? '+' : ''}฿{Math.round(trueNetProfit).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: CRM */}
            {currentTab === 'crm' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-5 bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-2xl shadow-sm flex flex-col justify-between">
                    <div>
                      <p className="text-xs font-medium text-blue-100">จำนวนลูกค้าในระบบ</p>
                      <p className="text-4xl font-bold font-num mt-2">{allCustomers.length} <span className="text-sm font-normal">ท่าน</span></p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/20 flex justify-between items-center text-xs">
                      <span className="text-blue-100">อัตราลูกค้ามาซ้ำ</span>
                      <span className="font-bold text-amber-300 font-num">{returnRatePercent}%</span>
                    </div>
                  </div>

                  <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex flex-col">
                    <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider text-center mb-2">สัดส่วนช่องทางที่รู้จักร้าน</h3>
                    <div className="flex-1 min-h-[140px]">
                      {sourceChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={sourceChartData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                              {sourceChartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />))}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={28} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (<div className="h-full flex items-center justify-center text-slate-400 text-xs">ไม่มีข้อมูล</div>)}
                    </div>
                  </div>

                  <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex flex-col">
                    <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider text-center mb-2">สัดส่วนช่วงอายุลูกค้า</h3>
                    <div className="flex-1 min-h-[140px]">
                      {ageChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={ageChartData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                              {ageChartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={PIE_COLORS[(index + 2) % PIE_COLORS.length]} />))}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={28} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (<div className="h-full flex items-center justify-center text-slate-400 text-xs">ไม่มีข้อมูล</div>)}
                    </div>
                  </div>

                  <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex flex-col justify-between">
                    <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider text-center mb-3">5 อันดับพื้นที่ลูกค้าหลัก</h3>
                    <div className="space-y-2.5 flex-1 justify-center flex flex-col">
                      {top5Areas.length > 0 ? top5Areas.map((area, idx) => {
                        const percent = allCustomers.length > 0 ? Math.round((area.count / allCustomers.length) * 100) : 0;
                        return (
                          <div key={idx}>
                            <div className="flex justify-between text-[10px] mb-0.5">
                              <span className="font-semibold text-slate-700 truncate w-28" title={area.name}>{area.name}</span>
                              <span className="font-bold text-blue-600 font-num">{percent}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-full rounded-full ${idx === 0 ? 'bg-blue-600' : idx === 1 ? 'bg-amber-500' : 'bg-slate-400'}`} style={{ width: `${percent}%` }}></div>
                            </div>
                          </div>
                        )
                      }) : (<div className="text-center text-slate-400 text-xs">ไม่มีข้อมูลพื้นที่</div>)}
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-amber-50/60 border border-amber-200/80 rounded-2xl">
                  <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-3">ลูกค้ามียอดขายสูงสุด 3 อันดับแรก (Top VIPs)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {topVIPs.map((vip, i) => (
                      <div key={i} className="bg-white p-3.5 rounded-xl border border-amber-200/80 flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold font-num ${i===0 ? 'bg-amber-500 text-white' : i===1 ? 'bg-slate-300 text-slate-800' : 'bg-amber-100 text-amber-800'}`}>
                          #{i+1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 text-xs truncate">{vip.name}</p>
                          <p className="text-[10px] text-slate-400 font-num">{vip.phone}</p>
                          <p className="text-amber-600 font-bold text-xs mt-0.5 font-num">฿{Math.round(vip.totalSpent).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-bold text-slate-800">ทำเนียบรายชื่อลูกค้าทั้งหมด</h3>
                      <p className="text-xs text-slate-400">ดึงข้อมูลสมาชิกและประวัติการนำของมาขาย</p>
                    </div>
                    <input 
                      type="text" 
                      placeholder="ค้นหา ชื่อ, เบอร์โทร, พื้นที่..." 
                      value={crmSearch} 
                      onChange={(e) => setCrmSearch(e.target.value)} 
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs w-full sm:w-64 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-medium">
                          <th className="pb-2.5 pl-2">ชื่อลูกค้า</th>
                          <th className="pb-2.5">เบอร์โทรศัพท์</th>
                          <th className="pb-2.5">พื้นที่ / จังหวัด</th>
                          <th className="pb-2.5 text-center">อายุ</th>
                          <th className="pb-2.5 text-center">จำนวนครั้ง</th>
                          <th className="pb-2.5 text-right">ยอดรับซื้อสะสม</th>
                          <th className="pb-2.5 text-center">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {paginatedCustomers.length === 0 ? (
                          <tr><td colSpan="7" className="py-6 text-center text-slate-400">ไม่พบข้อมูลลูกค้า</td></tr>
                        ) : (
                          paginatedCustomers.map((cust, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 pl-2 font-bold text-slate-800">{cust.name}</td>
                              <td className="py-3 font-num text-slate-500">{cust.phone}</td>
                              <td className="py-3 text-slate-600 font-medium">{formatShortLoc(cust.address)}</td>
                              <td className="py-3 text-center font-semibold text-slate-600">{cust.age > 0 ? `${cust.age} ปี` : '-'}</td>
                              <td className="py-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${cust.visits > 1 ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                  {cust.visits} ครั้ง
                                </span>
                              </td>
                              <td className="py-3 text-right font-bold text-slate-900 font-num">฿{Math.round(cust.totalSpent).toLocaleString()}</td>
                              <td className="py-3 text-center">
                                <button onClick={() => setViewCustomerDetail(cust)} className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-[10px]">
                                  ดูประวัติ
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {crmTotalPages > 1 && (
                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100 text-xs">
                      <span className="text-slate-400">หน้า {crmPage} / {crmTotalPages}</span>
                      <div className="flex space-x-1">
                        <button disabled={crmPage === 1} onClick={() => setCrmPage(p => Math.max(p - 1, 1))} className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40">ก่อนหน้า</button>
                        <button disabled={crmPage === crmTotalPages} onClick={() => setCrmPage(p => Math.min(p + 1, crmTotalPages))} className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40">ถัดไป</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: STOCK OUT (RECONCILIATION) */}
            {currentTab === 'reconciliation' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200/80 justify-end text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-600">กรองราคาทองต่ำกว่า:</span>
                    <input type="number" placeholder="เช่น 64000" value={maxGoldPriceFilter} onChange={(e) => setMaxGoldPriceFilter(e.target.value)} className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-num font-bold text-slate-800" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-600">กรองราคาเงินต่ำกว่า:</span>
                    <input type="number" placeholder="เช่น 58" value={maxSilverPriceFilter} onChange={(e) => setMaxSilverPriceFilter(e.target.value)} className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-num font-bold text-slate-800" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">สต็อกทองที่เลือก</span>
                      <p className="text-2xl font-bold text-slate-800 mt-2 font-num">฿{safeNum(batch.goldCost).toLocaleString()}</p>
                      <p className="text-xs text-slate-400 mt-0.5">ชั่งรวม: {safeNum(batch.goldWeight).toFixed(2)} ก. | ค่าสกัด: ฿{safeNum(batch.goldFee).toLocaleString()}</p>
                    </div>
                    <div className="text-right border-l border-slate-100 pl-4">
                      <p className="text-[10px] font-medium text-slate-400">ราคาตลาดเฉลี่ย</p>
                      <p className="text-base font-bold text-slate-800 font-num">฿{Math.round(safeNum(batch.avgGoldMarketPrice)).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">สต็อกเงินที่เลือก</span>
                      <p className="text-2xl font-bold text-slate-800 mt-2 font-num">฿{safeNum(batch.silverCost).toLocaleString()}</p>
                      <p className="text-xs text-slate-400 mt-0.5">ชั่งรวม: {safeNum(batch.silverWeight).toFixed(2)} ก. | ค่าสกัด: ฿{safeNum(batch.silverFee).toLocaleString()}</p>
                    </div>
                    <div className="text-right border-l border-slate-100 pl-4">
                      <p className="text-[10px] font-medium text-slate-400">ราคาตลาดเฉลี่ย</p>
                      <p className="text-base font-bold text-slate-800 font-num">฿{safeNum(batch.avgSilverMarketPrice).toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-[#0f172a] text-white rounded-2xl shadow-md space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <h4 className="font-bold text-base">ประเมินและยืนยันส่งขายโรงหลอม</h4>
                    <button onClick={handleConfirmStockOut} disabled={submitting || batch.selectedCount === 0} className={`px-5 py-2 rounded-xl font-bold text-xs transition-all ${batch.selectedCount > 0 ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>
                      {submitting ? 'กำลังบันทึก...' : 'บันทึกยืนยันตัดขายล็อตนี้'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-4 space-y-3">
                      <div>
                        <label className="block text-[10px] font-medium text-slate-400 mb-1">ราคาขายทอง (บาท/บาททอง)</label>
                        <input type="number" placeholder="เช่น 64200" value={targetPrices.goldSalePricePerBaht} onChange={(e) => setTargetPrices({...targetPrices, goldSalePricePerBaht: e.target.value})} className="w-full px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 text-white rounded-lg font-num focus:outline-none focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-slate-400 mb-1">ราคาขายเงิน (บาท/กรัม)</label>
                        <input type="number" placeholder="เช่น 58" value={targetPrices.silverSalePricePerGram} onChange={(e) => setTargetPrices({...targetPrices, silverSalePricePerGram: e.target.value})} className="w-full px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 text-white rounded-lg font-num focus:outline-none focus:border-blue-500" />
                      </div>
                    </div>

                    <div className="md:col-span-8 flex justify-end">
                      <div className="bg-white/10 p-4 rounded-xl border border-white/10 text-right min-w-[220px]">
                        <p className="text-[10px] font-medium text-slate-300 uppercase">รวมกำไรสุทธิจริงล็อตนี้</p>
                        <p className={`text-3xl font-bold font-num mt-1 ${batch.totalPnLAll >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {batch.totalPnLAll >= 0 ? '+' : ''}฿{Math.round(safeNum(batch.totalPnLAll)).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-bold text-slate-800">เลือกชิ้นงานจากตู้เซฟส่งขาย</h3>
                      <p className="text-xs text-slate-400">พบ {filteredDetailsList.length} รายการที่ยังไม่ได้ขาย</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
                        <button onClick={() => setItemTypeFilter('All')} className={`px-2.5 py-1 rounded ${itemTypeFilter === 'All' ? 'bg-white text-slate-800 font-bold shadow-2xs' : 'text-slate-500'}`}>ทั้งหมด</button>
                        <button onClick={() => setItemTypeFilter('ทอง')} className={`px-2.5 py-1 rounded ${itemTypeFilter === 'ทอง' ? 'bg-amber-500 text-white font-bold' : 'text-slate-500'}`}>ทองคำ</button>
                        <button onClick={() => setItemTypeFilter('เงิน')} className={`px-2.5 py-1 rounded ${itemTypeFilter === 'เงิน' ? 'bg-slate-700 text-white font-bold' : 'text-slate-500'}`}>เงิน</button>
                      </div>
                      
                      <button onClick={toggleSelectAllFiltered} className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100">
                        เลือก/ยกเลิก ทั้งหมด
                      </button>

                      {/* 🖨️ ปุ่มพิมพ์ใบหาของตู้เซฟ A4 แนวนอน */}
                      <button 
                        onClick={handlePrintSelected} 
                        disabled={batch.selectedCount === 0}
                        className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-2xs ${batch.selectedCount > 0 ? 'bg-slate-800 hover:bg-slate-700 text-white cursor-pointer active:scale-95' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                      >
                        🖨️ พิมพ์ใบหาของ ({batch.selectedCount})
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-medium">
                          <th className="pb-2.5 text-center w-10">เลือก</th>
                          <th className="pb-2.5">รหัสบิล</th>
                          <th className="pb-2.5">ประเภท</th>
                          <th className="pb-2.5 text-right">น้ำหนัก (g)</th>
                          <th className="pb-2.5 text-center">X-Ray %</th>
                          <th className="pb-2.5 text-right">รับซื้อตลาด</th>
                          <th className="pb-2.5 text-right">รับซื้อสุทธิ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {paginatedDetailsList.length === 0 ? (
                          <tr><td colSpan="7" className="py-6 text-center text-slate-400">ไม่พบรายการในตู้เซฟ</td></tr>
                        ) : (
                          paginatedDetailsList.map((detail, idx) => {
                            const isChecked = !!selectedItems[`${cleanStr(detail.orderId)}-${detail.itemNo}`];
                            return (
                              <tr key={idx} onClick={() => toggleItemSelection(detail.orderId, detail.itemNo)} className={`hover:bg-slate-50 cursor-pointer ${isChecked ? 'bg-blue-50/40' : ''}`}>
                                <td className="py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input type="checkbox" checked={isChecked} onChange={() => toggleItemSelection(detail.orderId, detail.itemNo)} className="w-3.5 h-3.5 text-blue-600 rounded" />
                                </td>
                                <td className="py-2.5 font-num text-slate-500">{detail.orderId}</td>
                                <td className="py-2.5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${detail.itemType === 'ทอง' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                                    {detail.itemType}
                                  </span>
                                </td>
                                <td className="py-2.5 text-right font-num font-semibold text-blue-600">{safeNum(detail.weightAfter)} g</td>
                                <td className="py-2.5 text-center font-num font-bold text-emerald-600">{safeNum(detail.percent)}%</td>
                                <td className="py-2.5 text-right font-num text-slate-500">฿{safeNum(detail.marketPrice).toLocaleString()}</td>
                                <td className="py-2.5 text-right font-num font-bold text-slate-900">฿{safeNum(detail.itemTotal).toLocaleString()}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100 text-xs">
                      <span className="text-slate-400">หน้า {currentPage} / {totalPages}</span>
                      <div className="flex space-x-1">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40">ก่อนหน้า</button>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40">ถัดไป</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: HISTORY */}
            {currentTab === 'history' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-5 bg-emerald-700 text-white rounded-2xl shadow-xs space-y-1">
                    <p className="text-[11px] font-medium text-emerald-100 uppercase">กำไรสุทธิจริงรับรู้แล้ว</p>
                    <p className="text-2xl font-bold font-num">฿{Math.round(historySummary.netProfitRealized).toLocaleString()}</p>
                  </div>
                  <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-1">
                    <p className="text-[11px] font-medium text-slate-400 uppercase">ยอดส่งขายรวม</p>
                    <p className="text-2xl font-bold text-slate-800 font-num">฿{Math.round(historySummary.totalRevenue).toLocaleString()}</p>
                  </div>
                  <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-1">
                    <p className="text-[11px] font-medium text-slate-400 uppercase">กำไรจากค่าสกัด</p>
                    <p className="text-2xl font-bold text-slate-800 font-num">฿{Math.round(historySummary.totalFee).toLocaleString()}</p>
                  </div>
                  <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-1">
                    <p className="text-[11px] font-medium text-slate-400 uppercase">กำไรส่วนต่างราคา</p>
                    <p className={`text-2xl font-bold font-num ${historySummary.totalTradingPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {historySummary.totalTradingPnL >= 0 ? '+' : ''}฿{Math.round(historySummary.totalTradingPnL).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
                  <h3 className="text-base font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">ประวัติการส่งขายแยกตามล็อต (Lot History)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-medium">
                          <th className="pb-2.5 pl-2">รหัสล็อต / วันที่ขาย</th>
                          <th className="pb-2.5 text-right">จำนวนชิ้น</th>
                          <th className="pb-2.5 text-right">ทอง (g)</th>
                          <th className="pb-2.5 text-right">เงิน (g)</th>
                          <th className="pb-2.5 text-right">ต้นทุนรับซื้อ</th>
                          <th className="pb-2.5 text-right">กำไรสุทธิจริง</th>
                          <th className="pb-2.5 text-center">รายละเอียด</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {paginatedHistoryList.length === 0 ? (
                          <tr><td colSpan="7" className="py-6 text-center text-slate-400">ไม่พบประวัติการส่งขาย</td></tr>
                        ) : (
                          paginatedHistoryList.map((lot, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-3 pl-2">
                                <p className="font-num font-bold text-slate-800">{lot.lotId}</p>
                                <p className="text-[10px] text-slate-400">{formatThaiDate(lot.saleDate)}</p>
                              </td>
                              <td className="py-3 text-right font-semibold">{lot.totalItems} ชิ้น</td>
                              <td className="py-3 text-right font-num font-bold text-amber-700">{safeNum(lot.goldWeight).toFixed(2)} g</td>
                              <td className="py-3 text-right font-num font-bold text-slate-600">{safeNum(lot.silverWeight).toFixed(2)} g</td>
                              <td className="py-3 text-right font-num text-slate-500">฿{Math.round(safeNum(lot.totalCost)).toLocaleString()}</td>
                              <td className={`py-3 text-right font-num font-bold ${safeNum(lot.netProfitRealized) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {safeNum(lot.netProfitRealized) >= 0 ? '+' : ''}฿{Math.round(safeNum(lot.netProfitRealized)).toLocaleString()}
                              </td>
                              <td className="py-3 text-center">
                                <button onClick={() => setViewLotDetail(lot)} className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-[10px]">
                                  ดูรายการ
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {historyTotalPages > 1 && (
                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100 text-xs">
                      <span className="text-slate-400">หน้า {historyPage} / {historyTotalPages}</span>
                      <div className="flex space-x-1">
                        <button disabled={historyPage === 1} onClick={() => setHistoryPage(p => Math.max(p - 1, 1))} className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40">ก่อนหน้า</button>
                        <button disabled={historyPage === historyTotalPages} onClick={() => setHistoryPage(p => Math.min(p + 1, historyTotalPages))} className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40">ถัดไป</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: EXPENSES */}
            {currentTab === 'expenses' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-5 bg-[#0f172a] text-white rounded-2xl shadow-xs space-y-1">
                    <p className="text-[11px] font-medium text-slate-400 uppercase">กำไรสุทธิแท้จริง (True Net Profit)</p>
                    <p className={`text-2xl font-bold font-num ${trueNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {trueNetProfit >= 0 ? '+' : ''}฿{Math.round(trueNetProfit).toLocaleString()}
                    </p>
                  </div>

                  <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-1">
                    <p className="text-[11px] font-medium text-slate-400 uppercase">รายจ่ายดำเนินงานรวม</p>
                    <p className="text-2xl font-bold text-rose-600 font-num">฿{Math.round(totalActualExpenses).toLocaleString()}</p>
                  </div>

                  <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-1">
                    <p className="text-[11px] font-medium text-slate-400 uppercase">ยอด VAT ซื้อที่เคลมได้</p>
                    <p className="text-2xl font-bold text-blue-600 font-num">฿{Math.round(totalClaimableVat).toLocaleString()}</p>
                  </div>

                  <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex flex-col justify-center">
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">สัดส่วนรายจ่ายแยกหมวด</p>
                    <div className="h-14 w-full">
                      {expCatPieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={expCatPieData} cx="50%" cy="50%" innerRadius={18} outerRadius={30} dataKey="value">
                              {expCatPieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />))}
                            </Pie>
                            <Tooltip formatter={(v) => `฿${v.toLocaleString()}`} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (<div className="h-full flex items-center justify-center text-slate-400 text-xs">ไม่มีข้อมูล</div>)}
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
                  <h3 className="text-base font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">
                    บันทึกค่าใช้จ่ายหน้าร้านประจำวัน
                  </h3>

                  <form onSubmit={handleSaveExpense} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">วันที่จ่ายเงิน</label>
                        <input 
                          type="date" 
                          value={expenseForm.date} 
                          onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})} 
                          className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-medium text-slate-800"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">ประเภทเอกสาร</label>
                        <select 
                          value={expenseForm.docType} 
                          onChange={(e) => {
                            const newDoc = e.target.value;
                            setExpenseForm(prev => {
                              const form = { ...prev, docType: newDoc };
                              if (newDoc !== 'ใบกำกับภาษี/ใบเสร็จรับเงิน') {
                                form.beforeVat = form.totalAmount;
                                form.vatAmount = 0;
                              }
                              return form;
                            });
                          }} 
                          className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none font-bold text-slate-700 cursor-pointer"
                        >
                          <option value="ใบเสร็จรับเงิน">ใบเสร็จรับเงิน</option>
                          <option value="ใบกำกับภาษี/ใบเสร็จรับเงิน">ใบกำกับภาษี/ใบเสร็จรับเงิน (เคลม VAT ได้)</option>
                          <option value="บิลเงินสด">บิลเงินสด</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">หมวดหมู่ค่าใช้จ่าย</label>
                        <select 
                          value={expenseForm.category} 
                          onChange={(e) => setExpenseForm({...expenseForm, category: e.target.value})} 
                          className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none font-medium text-slate-800 cursor-pointer"
                        >
                          <option value="ค่าน้ำ / ค่าไฟฟ้า / อินเทอร์เน็ต">ค่าน้ำ / ค่าไฟฟ้า / อินเทอร์เน็ต</option>
                          <option value="ค่าเดินทาง / ค่าน้ำ">ค่าเดินทาง / ค่าน้ำ</option>
                          <option value="ค่าจ้าง / ค่าอาหาร / เบี้ยเลี้ยงพนักงาน">ค่าจ้าง / ค่าอาหาร / เบี้ยเลี้ยงพนักงาน</option>
                          <option value="ค่าอุปกรณ์">ค่าอุปกรณ์</option>
                          <option value="ค่าป้าย / โฆษณา / การตลาด">ค่าป้าย / โฆษณา / การตลาด</option>
                          <option value="อื่นๆ">อื่นๆ</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">ผู้จ่ายเงิน</label>
                        <select 
                          value={expenseForm.payer} 
                          onChange={(e) => handlePayerChange(e.target.value)} 
                          className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none font-bold text-slate-800 cursor-pointer"
                        >
                          <option value="แม่กบทอง">แม่กบทอง (บริษัท)</option>
                          <option value="อู">อู</option>
                          <option value="ออม">ออม</option>
                          <option value="กบ">กบ</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">สถานะ</label>
                        <select 
                          value={expenseForm.status} 
                          onChange={(e) => setExpenseForm({...expenseForm, status: e.target.value})} 
                          className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none font-bold text-slate-800 cursor-pointer"
                        >
                          <option value="จ่ายแล้ว">จ่ายแล้ว</option>
                          <option value="รอจ่ายคืน">รอจ่ายคืน</option>
                          <option value="จ่ายคืนแล้ว">จ่ายคืนแล้ว</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">ยอดรวมจ่ายจริง (บาท)</label>
                        <input 
                          type="number" 
                          placeholder="เช่น 1500" 
                          value={expenseForm.totalAmount} 
                          onChange={(e) => handleExpenseTotalChange(e.target.value)} 
                          className="w-full px-3 py-1.5 text-sm font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-num text-slate-900"
                          required
                        />
                      </div>

                      {expenseForm.docType === 'ใบกำกับภาษี/ใบเสร็จรับเงิน' ? (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">ยอดก่อน VAT</label>
                            <input type="number" value={expenseForm.beforeVat} readOnly className="w-full px-3 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-lg font-num text-slate-600" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-blue-600 mb-1">ภาษีซื้อ VAT 7% (เคลมได้)</label>
                            <input type="number" value={expenseForm.vatAmount} readOnly className="w-full px-3 py-1.5 text-xs bg-blue-50 border border-blue-200 rounded-lg font-num font-bold text-blue-700" />
                          </div>
                        </>
                      ) : (
                        <div className="sm:col-span-2 flex items-center text-xs text-slate-400">
                          บิลรับซื้อทั่วไป ไม่มีการแยกคำนวณ VAT ซื้อ
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                      <div className="flex-1 w-full">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">หมายเหตุเพิ่มเติม</label>
                        <input 
                          type="text" 
                          placeholder="เช่น ค่าน้ำมันรถไปส่งของโรงหลอมกรุงเทพฯ" 
                          value={expenseForm.notes} 
                          onChange={(e) => setExpenseForm({...expenseForm, notes: e.target.value})} 
                          className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none text-slate-800"
                        />
                      </div>
                      <button 
                        type="submit" 
                        disabled={submitting}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs active:scale-95 whitespace-nowrap w-full sm:w-auto cursor-pointer"
                      >
                        {submitting ? 'กำลังบันทึก...' : 'บันทึกค่าใช้จ่าย'}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-bold text-slate-800">ตารางประวัติรายการค่าใช้จ่าย</h3>
                      <p className="text-xs text-slate-400">พบทั้งหมด {searchedExpenses.length} รายการ (แสดงหน้าละ 10 แถว)</p>
                    </div>
                    <input 
                      type="text" 
                      placeholder="ค้นหา ผู้จ่าย, หมวดหมู่..." 
                      value={expenseSearch} 
                      onChange={(e) => setExpenseSearch(e.target.value)} 
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs w-full sm:w-64 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-medium">
                          <th className="pb-2.5 pl-2">วันที่จ่าย</th>
                          <th className="pb-2.5">ประเภทเอกสาร</th>
                          <th className="pb-2.5">หมวดหมู่</th>
                          <th className="pb-2.5 text-right">ยอดรวม (บาท)</th>
                          <th className="pb-2.5 text-right">VAT ซื้อ</th>
                          <th className="pb-2.5 text-center">ผู้จ่าย</th>
                          <th className="pb-2.5 text-center">สถานะเบิกคืน</th>
                          <th className="pb-2.5">หมายเหตุ</th>
                          <th className="pb-2.5 text-center">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {paginatedExpenses.length === 0 ? (
                          <tr><td colSpan="9" className="py-6 text-center text-slate-400">ไม่มีรายการค่าใช้จ่ายในกรอบเวลานี้</td></tr>
                        ) : (
                          paginatedExpenses.map((exp, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-3 pl-2 font-num text-slate-600">{formatThaiDate(exp.date)}</td>
                              <td className="py-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${exp.docType === 'ใบกำกับภาษี/ใบเสร็จรับเงิน' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                  {exp.docType}
                                </span>
                              </td>
                              <td className="py-3 font-medium text-slate-800">{exp.category}</td>
                              <td className="py-3 text-right font-bold font-num text-rose-600">฿{safeNum(exp.totalAmount).toLocaleString()}</td>
                              <td className="py-3 text-right font-num text-blue-600 font-bold">
                                {exp.vatAmount > 0 ? `฿${safeNum(exp.vatAmount).toLocaleString()}` : '-'}
                              </td>
                              <td className="py-3 text-center font-semibold text-slate-800">{exp.payer}</td>
                              <td className="py-3 text-center">
                                {exp.payer === 'แม่กบทอง' ? (
                                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-semibold">จ่ายแล้ว</span>
                                ) : (
                                  <button 
                                    onClick={() => handleToggleExpenseStatus(exp.expenseId, exp.status)}
                                    className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${exp.status === 'จ่ายคืนแล้ว' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
                                  >
                                    {exp.status === 'จ่ายคืนแล้ว' ? 'จ่ายคืนแล้ว' : 'รอจ่ายคืน'}
                                  </button>
                                )}
                              </td>
                              <td className="py-3 text-slate-500 max-w-xs truncate">{exp.notes || '-'}</td>
                              <td className="py-3 text-center">
                                <button onClick={() => handleDeleteExpense(exp.expenseId)} className="text-slate-400 hover:text-rose-600 font-semibold text-[10px] px-2 py-0.5 rounded bg-slate-100">
                                  ลบ
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {expenseTotalPages > 1 && (
                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100 text-xs">
                      <span className="text-slate-400">หน้า {expensePage} / {expenseTotalPages}</span>
                      <div className="flex space-x-1">
                        <button disabled={expensePage === 1} onClick={() => setExpensePage(p => Math.max(p - 1, 1))} className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40">ก่อนหน้า</button>
                        <button disabled={expensePage === expenseTotalPages} onClick={() => setExpensePage(p => Math.min(p + 1, expenseTotalPages))} className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40">ถัดไป</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* MODAL: ล็อตส่งขาย */}
      {viewLotDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 text-base">รายการบิลในล็อตนี้</h3>
                <p className="text-xs text-slate-500 font-num">{viewLotDetail.lotId}</p>
              </div>
              <button onClick={() => setViewLotDetail(null)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">ปิด</button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100"><p className="text-slate-400">จำนวนทั้งหมด</p><p className="font-bold text-blue-600 text-lg mt-0.5 font-num">{viewLotDetail.totalItems} รายการ</p></div>
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100"><p className="text-emerald-700">กำไรสุทธิรวมล็อตนี้</p><p className="font-bold text-emerald-700 text-lg mt-0.5 font-num">฿{Math.round(safeNum(viewLotDetail.netProfitRealized)).toLocaleString()}</p></div>
              </div>
              <p className="text-xs font-bold text-slate-800 mb-2">รายการรหัสบิลลูกค้า (OrderID-ItemNo)</p>
              <div className="flex flex-wrap gap-1.5">
                {viewLotDetail.itemsDetail && viewLotDetail.itemsDetail.length > 0 ? (
                  viewLotDetail.itemsDetail.map((itemKey, i) => (<span key={i} className="px-2.5 py-1 bg-slate-50 border border-slate-200 text-slate-600 rounded text-xs font-num font-semibold">{itemKey}</span>))
                ) : (<p className="text-xs text-slate-400 italic">ไม่พบรายละเอียดรายการย่อย</p>)}
              </div>
            </div>
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-right">
              <button onClick={() => setViewLotDetail(null)} className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700">ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ประวัติลูกค้าเชิงลึก */}
      {viewCustomerDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{viewCustomerDetail.name}</h3>
                <p className="text-xs text-slate-500 font-num mt-0.5">เบอร์โทร: {viewCustomerDetail.phone} | อายุ: {viewCustomerDetail.age || '-'} ปี | ที่อยู่: {viewCustomerDetail.address}</p>
              </div>
              <button onClick={() => setViewCustomerDetail(null)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">ปิด</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-white p-3 rounded-xl border border-slate-100 text-center"><p className="text-[10px] text-slate-400 font-bold uppercase">มาขายแล้ว</p><p className="font-bold text-blue-600 text-lg mt-0.5 font-num">{viewCustomerDetail.visits} ครั้ง</p></div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 text-center"><p className="text-[10px] text-slate-400 font-bold uppercase">ยอดเงินรวมที่ได้</p><p className="font-bold text-emerald-600 text-lg mt-0.5 font-num">฿{Math.round(viewCustomerDetail.totalSpent).toLocaleString()}</p></div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 text-center"><p className="text-[10px] text-slate-400 font-bold uppercase">รู้จักจาก</p><p className="font-bold text-amber-600 text-xs mt-1.5">{viewCustomerDetail.source}</p></div>
              </div>

              <h4 className="font-bold text-slate-800 mb-2 text-xs">ประวัติการนำของมาขาย</h4>
              <div className="space-y-2">
                {viewCustomerDetail.orderIds.slice().reverse().map((oid, idx) => {
                  const relatedDetails = detailsList.filter(d => cleanStr(d.orderId) === cleanStr(oid));
                  const billTotal = relatedDetails.reduce((sum, d) => sum + safeNum(d.itemTotal), 0);
                  const orderDate = ordersList.find(o => cleanStr(o.orderId) === cleanStr(oid))?.date;
                  return (
                    <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3 text-xs">
                      <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-50">
                        <span className="font-num font-bold text-slate-700">บิลเลขที่: {oid} ({formatThaiDate(orderDate)})</span>
                        <span className="font-bold text-slate-900 font-num">฿{Math.round(billTotal).toLocaleString()}</span>
                      </div>
                      <div className="space-y-1">
                        {relatedDetails.map((detail, dIdx) => (
                          <div key={dIdx} className="flex justify-between items-center text-[11px] bg-slate-50 px-2.5 py-1 rounded">
                            <span>{detail.itemType} (หนัก {safeNum(detail.weightAfter)} g)</span>
                            <span className="font-num text-slate-600">X-Ray {safeNum(detail.percent)}% = ฿{Math.round(safeNum(detail.itemTotal)).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="px-6 py-3 bg-white border-t border-slate-100 text-right">
              <button onClick={() => setViewCustomerDetail(null)} className="px-4 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800">ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;