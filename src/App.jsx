import React, { useState } from 'react';

function App() {
  // ระบบสลับหน้าเมนู (Dashboard, TFEX, ตัดสต็อก)
  const [currentTab, setCurrentTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Navigation Bar ด้านบน สไตล์ Apple Minimalist */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-slate-200/80 px-8 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse"></div>
          <span className="text-lg font-semibold tracking-tight">Precious Metals HQ</span>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50">
          <button 
            onClick={() => setCurrentTab('dashboard')}
            className={`px-5 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${currentTab === 'dashboard' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setCurrentTab('tfex')}
            className={`px-5 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${currentTab === 'tfex' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            TFEX
          </button>
          <button 
            onClick={() => setCurrentTab('reconciliation')}
            className={`px-5 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${currentTab === 'reconciliation' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            ระบบตัดสต็อก
          </button>
        </div>
      </nav>

      {/* พื้นที่แสดงเนื้อหาหลักของแต่ละหน้าจอ */}
      <main className="max-w-7xl mx-auto p-8">
        {currentTab === 'dashboard' && (
          <div className="space-y-6 animate-fadeIn">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Executive Dashboard</h1>
            <p className="text-slate-500 text-sm">ยินดีต้อนรับผู้บริหาร, ระบบเตรียมพร้อมคำนวณแบบ Real-time</p>
            {/* จุดนี้ในอนาคตเราจะเอาการ์ดข้อมูลต่างๆ มาใส่ไว้ครับ */}
            <div className="p-8 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm backdrop-blur-sm">
              <p className="text-slate-400 text-center text-sm py-12">กำลังเชื่อมต่อฐานข้อมูล Google Sheets...</p>
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