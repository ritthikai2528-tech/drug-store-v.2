// ─── STATE ───────────────────────────────
let currentUser = null;
let appSettings = {};
let allMedicines = [];
let allTransactions = [];
let allUsers = [];
let dashData = null;
let resetStockItems = [];
let forecastData = [];
let reportData = [];
let chartCat = null, chartMonthly = null;
let selectedRxIds = new Set();
let selectedOutIds = new Set();

let activeCatFilter = null;
let activeMonthFilterKey = null;
let savedLineBots = []; // เพิ่มบรรทัดนี้ลงไปเพื่อเก็บโปรไฟล์ Bot

const HEADER_TH = {
  code13:'รหัส13หลัก', nameTH:'ชื่อยา', category:'หมวดหมู่', unit:'หน่วย', price:'ราคา/หน่วย',
  unitPerBox:'จำนวน/กล่อง', stock:'คงเหลือ', avgOut:'เฉลี่ยเบิก/เดือน', target2months:'เป้า2เดือน',
  toOrder:'ต้องเบิก(หน่วย)', boxes:'เบิก(กล่อง)', inQty:'รับเข้า', outQty:'จ่ายออก', retQty:'คืน',
  defQty:'ชำรุด', inValue:'มูลค่ารับ', outValue:'มูลค่าจ่าย', id:'รหัส', type:'ประเภท', lot:'Lot',
  expDate:'หมดอายุ', qty:'จำนวน', date:'วันที่', note:'หมายเหตุ', requestBy:'ผู้เบิก',
  receivedBy:'ผู้รับ', totalPrice:'รวมราคา', location:'คลังที่เก็บ', warehouse:'คลังที่เก็บ'
};

// ─── GAS RPC ─────────────────────────────
function gas(fn, ...args) {
  return new Promise((res, rej) => {
    google.script.run.withSuccessHandler(res).withFailureHandler(rej)[fn](...args);
  });
}

// ─── TOAST ───────────────────────────────
function toast(msg, type='success', duration=3500) {
  const c = document.getElementById('toast-container');
  const el = document.createElement('div');
  const colors = {success:'#10b981',error:'#ef4444',warning:'#f59e0b',info:'#3b82f6'};
  el.className = 'toast';
  el.style.background = colors[type]||colors.success;
  el.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':type==='error'?'times-circle':type==='warning'?'exclamation-triangle':'info-circle'} mr-2"></i>${msg}`;
  c.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

function showLoading(show) {
  document.getElementById('loading-screen').style.display = show ? 'flex' : 'none';
}

function toggleDark() {
  document.body.classList.toggle('dark');
  document.getElementById('dark-icon').className = document.body.classList.contains('dark') ? 'fas fa-sun' : 'fas fa-moon';
  localStorage.setItem('darkMode', document.body.classList.contains('dark'));
}

let sidebarCollapsed = false;
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const mc = document.getElementById('main-content');
  if (window.innerWidth < 768) {
    sb.style.transform = sb.style.transform === 'translateX(0px)' ? 'translateX(-100%)' : 'translateX(0px)';
    document.getElementById('overlay').style.display = sb.style.transform === 'translateX(0px)' ? 'block' : 'none';
  } else {
    sidebarCollapsed = !sidebarCollapsed;
    sb.classList.toggle('collapsed', sidebarCollapsed);
    mc.style.marginLeft = sidebarCollapsed ? '64px' : '260px';
  }
}
function closeSidebarMobile() {
  document.getElementById('sidebar').style.transform = 'translateX(-100%)';
  document.getElementById('overlay').style.display = 'none';
}

// ─── LOGIN ───────────────────────────────
async function doLogin() {
  const u = document.getElementById('inp-username').value.trim();
  const p = document.getElementById('inp-password').value.trim();
  if (!u || !p) { toast('กรุณากรอกข้อมูล','warning'); return; }
  showLoading(true);
  try {
    const res = await gas('login', u, p);
    if (!res.ok) { toast(res.message,'error'); showLoading(false); return; }
    currentUser = res.user;
    appSettings = res.settings || {};
    applySettings();
    initApp();
  } catch(e) { toast('เกิดข้อผิดพลาด: '+e.message,'error'); showLoading(false); }
}

function doLogout() {
  currentUser = null;
  document.getElementById('app-layout').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('inp-password').value = '';
}

function applySettings() {
  const s = appSettings;
  setText('sb-store-name', s.storeName||'คลังยา รพ.สต.');
  setText('sb-store-addr', s.storeAddress||'');
  setText('login-store-name', s.storeName||'');
  setText('login-store-addr', s.storeAddress||'');
  setText('login-credit', s.creditText||'Credit By Ritwet_hospital_DrugStock');
  setText('footer-credit', s.creditText||'Credit By Ritwet_hospital_DrugStock');
  setText('print-store-name', s.storeName||'');
  setText('print-store-addr', s.storeAddress||'');
  
  // [NEW] แสดงโลโก้หน่วยงาน
  const logoUrl = s.storeLogo ? s.storeLogo.replace('drive.google.com/uc?id=', 'lh3.googleusercontent.com/d/') : '';
  ['sb', 'login'].forEach(prefix => {
    const imgEl = document.getElementById(`${prefix}-store-logo-img`);
    const svgEl = document.getElementById(`${prefix}-store-logo-svg`);
    if (!imgEl || !svgEl) return;
    if (logoUrl) {
      imgEl.src = logoUrl;
      imgEl.style.display = 'block';
      svgEl.style.display = 'none';
      imgEl.onerror = function() { 
        this.style.display = 'none'; 
        svgEl.style.display = 'block'; 
      };
    } else {
      imgEl.style.display = 'none';
      svgEl.style.display = 'block';
    }
  });
  // จัดการ Text Marquee
   const mqContainer = document.getElementById('marquee-container');
   if(s.marqueeText && s.marqueeText.trim() !== '') {
       document.getElementById('disp-marquee').innerText = s.marqueeText;
       mqContainer.style.display = 'flex';
   } else { mqContainer.style.display = 'none'; }

   // จัดการ Image Marquee
   const mqImgContainer = document.getElementById('img-marquee-container');
   if(s.marqueeImgs && s.marqueeImgs.trim() !== '') {
       const urls = s.marqueeImgs.split(',');
       const disp = document.getElementById('disp-img-marquee');
       disp.innerHTML = urls.map(u => `<img src="${u.trim()}" class="h-20 object-cover rounded shadow-sm border bg-white p-1 mx-1 shrink-0">`).join('');
       disp.innerHTML += disp.innerHTML; // เบิ้ลรูปให้เลื่อนเนียน
       mqImgContainer.style.display = 'block';
   } else { mqImgContainer.style.display = 'none'; }

   if(s.marqueeText || s.marqueeImgs) document.getElementById('dashboard-marquees').style.display = 'block';
   else document.getElementById('dashboard-marquees').style.display = 'none';

   // จัดการ Floating Image
   if(s.floatingImg && s.floatingImg.trim() !== '') startFloatingImage(s.floatingImg.trim());
   else {
       const el = document.getElementById('floating-img-element');
       if(el) { el.style.display = 'none'; el.src = ''; }
       if(window.floatAnimId) cancelAnimationFrame(window.floatAnimId);
   }
}
window.floatX = 0; window.floatY = 0; window.floatVX = 1.2; window.floatVY = 1.2; window.floatAnimId = null;
function startFloatingImage(imgUrl) {
    const el = document.getElementById('floating-img-element');
    if(!imgUrl || !el) return;
    el.src = imgUrl; el.style.display = 'block';
    if(window.floatAnimId) cancelAnimationFrame(window.floatAnimId);
    window.floatX = Math.random() * (window.innerWidth - 150); window.floatY = Math.random() * (window.innerHeight - 80);
    function animate() {
        if(el.style.display === 'none') return;
        const w = el.offsetWidth || 100, h = el.offsetHeight || 100;
        const winW = window.innerWidth, winH = window.innerHeight;
        if (window.floatX + w >= winW) { window.floatVX = -Math.abs(window.floatVX); window.floatX = winW - w; }
        if (window.floatX <= 0) { window.floatVX = Math.abs(window.floatVX); window.floatX = 0; }
        if (window.floatY + h >= winH) { window.floatVY = -Math.abs(window.floatVY); window.floatY = winH - h; }
        if (window.floatY <= 0) { window.floatVY = Math.abs(window.floatVY); window.floatY = 0; }
        window.floatX += window.floatVX; window.floatY += window.floatVY;
        el.style.transform = `translate(${window.floatX}px, ${window.floatY}px)`;
        window.floatAnimId = requestAnimationFrame(animate);
    }
    el.onload = () => animate();
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function formatBE(dateStr) {
  if(!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  if(y && m && d) return `${d}/${m}/${parseInt(y)+543}`;
  return dateStr;
}

function initApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app-layout').style.display = 'block';
  showLoading(false);

  if (currentUser) {
    setText('sb-user-name', currentUser.name||currentUser.username);
    setText('sb-user-role', currentUser.role==='admin'?'ผู้ดูแลระบบ':'ผู้ใช้ทั่วไป');
    
    const avatarEl = document.getElementById('sb-user-avatar');
    const topbarAvatar = document.getElementById('topbar-avatar');
    
    const iconClass = currentUser.role === 'admin' ? 'fa-user-shield' : 'fa-user';
    const defaultIcon = `<div style="width:100%;height:100%;background:linear-gradient(135deg,#4facfe,#ff9a9e);display:flex;align-items:center;justify-content:center;color:#fff;"><i class="fas ${iconClass}"></i></div>`;
    
    let imgUrl = currentUser.imageUrl ? currentUser.imageUrl.replace('drive.google.com/uc?id=', 'lh3.googleusercontent.com/d/') : '';

    if (imgUrl) {
      const imgTag = `<img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.outerHTML='${defaultIcon.replace(/'/g, "\\'")}'"/>`;
      avatarEl.innerHTML = imgTag;
      topbarAvatar.innerHTML = imgTag;
    } else {
      avatarEl.innerHTML = defaultIcon;
      topbarAvatar.innerHTML = defaultIcon;
    }
    
    document.getElementById('admin-nav').style.display = currentUser.role==='admin' ? 'block' : 'none';
  }

  document.querySelectorAll('.nav-link').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); showPage(a.dataset.page); });
  });

  if (window.innerWidth < 768) {
    document.getElementById('sidebar').style.transform = 'translateX(-100%)';
    document.getElementById('main-content').style.marginLeft = '0';
  }

  if (localStorage.getItem('darkMode')==='true') {
    document.body.classList.add('dark');
    document.getElementById('dark-icon').className = 'fas fa-sun';
  }

  const yearSel = document.getElementById('rpt-year');
  const yr = new Date().getFullYear();
  yearSel.innerHTML = '';
  for (let y=yr; y>=yr-5; y--) {
    yearSel.innerHTML += `<option value="${y}">${y+543}</option>`;
  }
  document.getElementById('rpt-month').value = new Date().getMonth()+1;

  const today = new Date().toISOString().split('T')[0];
  const todayYM = today.substr(0,7);
  ['tx-date','reset-date'].forEach(id => { const el=document.getElementById(id); if(el) el.value=today; });
  ['tx-date-from','tx-date-to','tx-out-from','tx-out-to'].forEach(id => { const el=document.getElementById(id); if(el) el.value=todayYM; });

  // Update transaction location logic binding
  document.getElementById('tx-location').addEventListener('change', function() {
    const sel = document.getElementById('tx-medicine');
    if (sel.value) onMedSelect(sel);
  });

  showPage('dashboard');
  loadAllData();
}

function showPage(page) {
  document.querySelectorAll('.page-view').forEach(p => p.style.display='none');
  document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('nav-active'));
  const el = document.getElementById(`page-${page}`);
  if (el) el.style.display = 'block';
  const nav = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (nav) nav.classList.add('nav-active');
  const titles = {
    dashboard:'Dashboard สรุปภาพรวม', inventory:'คลังยา',
    receive:'รับยาเข้าคลัง', dispense:'เบิกจ่ายยา',
    report:'รายงานสรุป', forecast:'คำนวณเบิกเดือนหน้า',
    manual:'คู่มือการใช้งาน',
    users:'จัดการผู้ใช้', settings:'ตั้งค่าระบบ',
    'reset-stock':'เริ่มต้นสต๊อกใหม่'
  };
  setText('page-title', titles[page]||page);
  if (window.innerWidth<768) closeSidebarMobile();
  if (page==='dashboard') loadDashboard();
  if (page==='inventory') renderInventory();
  // [FIX] บังคับโหลดข้อมูลยาและประวัติใหม่ทั้งหมด (loadAllData) ก่อนดึงรายการ เพื่อให้สต๊อกอัปเดตตรงกัน
  if (page==='receive') { loadAllData().then(() => loadTransactions('receive')); }
  if (page==='dispense') { loadAllData().then(() => loadTransactions('dispense')); }
  if (page==='users') renderUsers();
  if (page==='settings') loadSettingsForm();
}

async function loadAllData() {
  try {
    // [FIXED] โหลดทีละคำสั่ง (Sequential) เพื่อป้องกัน Google Apps Script ดรอปคำสั่งหากยิงไปพร้อมกัน
    const mRes = await gas('getMedicines');
    if (mRes.ok) allMedicines = mRes.data;
    
    const tRes = await gas('getTransactions'); 
    if (tRes.ok) allTransactions = tRes.data;
    
    populateMedicineDropdowns();
    if(document.getElementById('page-dashboard').style.display === 'block') loadDashboard();
  } catch(e) { console.error('Error loading data:', e); }
}

async function refreshAll() {
  toast('กำลังรีเฟรชข้อมูล...','info',1500);
  await loadAllData();
  const activePage = document.querySelector('.page-view[style="display: block;"]')?.id?.replace('page-','');
  if (activePage) showPage(activePage);
  toast('รีเฟรชสำเร็จ','success');
}

// ─── DASHBOARD ───────────────────────────
async function loadDashboard() {
  try {
    const res = await gas('getDashboardData');
    if (!res.ok) { toast(res.message,'error'); return; }
    dashData = res.data;
    setText('stat-sku', dashData.totalSKU);
    setText('stat-nearexp', dashData.nearExpiryCount);
    setText('stat-lowstock', dashData.lowStockCount);
    
    activeCatFilter = null;
    activeMonthFilterKey = null;

    buildCharts(dashData);
    renderDashboardFiltered();
  } catch(e) { console.error(e); toast('โหลด dashboard ล้มเหลว','error'); }
}

function renderDashboardFiltered() {
  if (!dashData) return;
  const d = dashData;

  let expData = d.nearExpiry;
  let lowData = d.lowStock;
  
  if (activeCatFilter) {
      expData = expData.filter(t => {
         const m = allMedicines.find(x => String(x.id) === String(t.medicineId));
         return m && m.category === activeCatFilter;
      });
      lowData = lowData.filter(m => m.category === activeCatFilter);
  }

  const eTbody = document.getElementById('expiry-tbody');
  if (expData.length === 0) {
    eTbody.innerHTML = '<tr><td colspan="5" class="text-center text-green-600 py-4"><i class="fas fa-check-circle mr-1"></i>ไม่มีข้อมูล</td></tr>';
  } else {
    eTbody.innerHTML = expData.map(t => {
      const daysLeft = Math.round((new Date(t.expDate)-new Date())/(86400000));
      let cls = '', bg = '', col = '';
      if(daysLeft <= 7) { cls='text-red-600 font-bold'; bg='#fee2e2'; col='#b91c1c'; }
      else if(daysLeft <= 14) { cls='text-orange-500 font-bold'; bg='#ffedd5'; col='#c2410c'; }
      else if(daysLeft <= 30) { cls='text-yellow-600 font-bold'; bg='#fef3c7'; col='#a16207'; }
      else { cls='text-blue-600 font-bold'; bg='#e0f2fe'; col='#0369a1'; }
      
      return `<tr><td>${t.nameTH||''}</td><td>${t.lot||''}</td>
        <td class="${cls}">${formatBE(t.expDate)} <span class="badge" style="background:${bg};color:${col}">${daysLeft} วัน</span></td>
        <td><span class="badge" style="background:#f1f5f9;color:#334155">${t.location||'คลังใน'}</span></td>
        <td>${t.qty||0}</td></tr>`;
    }).join('');
  }

  const lTbody = document.getElementById('lowstock-tbody');
  if (lowData.length === 0) {
    lTbody.innerHTML = '<tr><td colspan="3" class="text-center text-green-600 py-4"><i class="fas fa-check-circle mr-1"></i>ไม่มีข้อมูล</td></tr>';
  } else {
    lTbody.innerHTML = lowData.map(m =>
      `<tr><td>${m.nameTH}</td>
       <td><span class="badge" style="background:#fee2e2;color:#b91c1c">${m.stock}</span></td>
       <td>${m.minStock}</td></tr>`
    ).join('');
  }

  const mnTH = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  if (activeMonthFilterKey && d.monthly[activeMonthFilterKey]) {
      const mData = d.monthly[activeMonthFilterKey];
      setText('stat-in', mData.in);
      setText('stat-out', mData.out);
      const mo = parseInt(activeMonthFilterKey.split('-')[1]);
      document.getElementById('lbl-stat-in').innerHTML = `<i class="fas fa-arrow-down mr-1"></i>รับเข้า (${mnTH[mo]})`;
      document.getElementById('lbl-stat-out').innerHTML = `<i class="fas fa-arrow-up mr-1"></i>เบิกจ่าย (${mnTH[mo]})`;
  } else {
      setText('stat-in', d.thisMonthIn);
      setText('stat-out', d.thisMonthOut);
      document.getElementById('lbl-stat-in').innerHTML = `<i class="fas fa-arrow-down mr-1"></i>รับเข้าเดือนนี้`;
      document.getElementById('lbl-stat-out').innerHTML = `<i class="fas fa-arrow-up mr-1"></i>เบิกจ่ายเดือนนี้`;
  }
}

function buildCharts(d) {
  const catCtx = document.getElementById('chart-category').getContext('2d');
  const cats = Object.keys(d.catStock);
  const catVals = cats.map(k => d.catStock[k]);
  const originalBg = ['#4facfe','#ff9a9e','#10b981','#f59e0b','#8b5cf6'];

  if (chartCat) chartCat.destroy();
  chartCat = new Chart(catCtx, {
    type: 'bar',
    data: { 
      labels: cats, 
      datasets: [{ 
        label: 'สต๊อกรวม', 
        data: catVals,
        backgroundColor: function(context) {
          const idx = context.dataIndex;
          if (!activeCatFilter) return originalBg[idx % originalBg.length];
          return cats[idx] === activeCatFilter ? originalBg[idx % originalBg.length] : '#e2e8f0';
        },
        borderRadius: 8 
      }] 
    },
    options: { 
      responsive: true, maintainAspectRatio: false, 
      plugins:{ legend:{ display:false } }, 
      scales: { y: { beginAtZero: true } },
      onClick: (e, elements) => {
        if (elements.length > 0) {
            const clickedCat = cats[elements[0].index];
            activeCatFilter = (activeCatFilter === clickedCat) ? null : clickedCat;
        } else {
            activeCatFilter = null;
        }
        chartCat.update();
        renderDashboardFiltered();
      }
    }
  });

  const mCtx = document.getElementById('chart-monthly').getContext('2d');
  const months = Object.keys(d.monthly);
  const mnTH = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

  if (chartMonthly) chartMonthly.destroy();
  chartMonthly = new Chart(mCtx, {
    type: 'line',
    data: { 
      labels: months.map(m => {
        const [y,mo] = m.split('-');
        return mnTH[parseInt(mo)];
      }),
      datasets: [
        { 
          label: 'รับเข้า', data: months.map(m=>d.monthly[m].in), 
          borderColor:'#4facfe', backgroundColor:'rgba(79,172,254,.1)', tension:.4, fill:true,
          pointBackgroundColor: function(context) {
             const idx = context.dataIndex;
             if (!activeMonthFilterKey) return '#4facfe';
             return months[idx] === activeMonthFilterKey ? '#0284c7' : '#e2e8f0';
          },
          pointRadius: function(context) {
             const idx = context.dataIndex;
             return months[idx] === activeMonthFilterKey ? 6 : 3;
          }
        },
        { 
          label: 'จ่ายออก', data: months.map(m=>d.monthly[m].out), 
          borderColor:'#ff9a9e', backgroundColor:'rgba(255,154,158,.1)', tension:.4, fill:true,
          pointBackgroundColor: function(context) {
             const idx = context.dataIndex;
             if (!activeMonthFilterKey) return '#ff9a9e';
             return months[idx] === activeMonthFilterKey ? '#be123c' : '#e2e8f0';
          },
          pointRadius: function(context) {
             const idx = context.dataIndex;
             return months[idx] === activeMonthFilterKey ? 6 : 3;
          }
        }
      ]},
    options: { 
      responsive: true, maintainAspectRatio: false, 
      plugins:{ legend:{ position:'top', labels:{ font:{ size:11 } } } },
      onClick: (e, elements) => {
        if (elements.length > 0) {
            const clickedMonth = months[elements[0].index];
            activeMonthFilterKey = (activeMonthFilterKey === clickedMonth) ? null : clickedMonth;
        } else {
            activeMonthFilterKey = null;
        }
        chartMonthly.update();
        renderDashboardFiltered();
      }
    }
  });
}

// ─── INVENTORY ───────────────────────────
async function renderInventory() {
  const tbody = document.getElementById('inv-tbody');
  tbody.innerHTML = '<tr><td colspan="11" class="text-center py-6 text-gray-400">กำลังโหลด...</td></tr>';
  try {
    const res = await gas('getMedicines');
    if (!res.ok) { toast(res.message,'error'); return; }
    allMedicines = res.data;
    filterInventory();
  } catch(e) { toast('โหลดข้อมูลล้มเหลว','error'); }
}

function filterInventory() {
  const q = (document.getElementById('inv-search')?.value||'').toLowerCase();
  const cat = document.getElementById('inv-cat-filter')?.value||'';
  let data = allMedicines.filter(m => {
    const match = !q || (m.nameTH||'').toLowerCase().includes(q) || (m.nameEN||'').toLowerCase().includes(q) || (m.code13||'').includes(q) || (m.category||'').toLowerCase().includes(q);
    const catMatch = !cat || m.category===cat;
    return match && catMatch;
  });
  const tbody = document.getElementById('inv-tbody');
  if (data.length===0) { tbody.innerHTML = '<tr><td colspan="11" class="text-center py-6 text-gray-400">ไม่พบรายการ</td></tr>'; return; }
  tbody.innerHTML = data.map(m => {
    const isLow = m.stock <= (m.minStock||0);
    const isAdmin = currentUser?.role==='admin';
    let imgUrl1 = m.imageUrl1 ? m.imageUrl1.replace('drive.google.com/uc?id=', 'lh3.googleusercontent.com/d/') : '';
    let imgUrl2 = m.imageUrl2 ? m.imageUrl2.replace('drive.google.com/uc?id=', 'lh3.googleusercontent.com/d/') : '';
    
    // [FIXED]: แสดงรูปลิ้งก์ทั้ง 2 รูป ถ้ามีบันทึกไว้
    let imageLink = '';
    if (imgUrl1 && imgUrl2) {
      imageLink = `
        <div class="flex flex-col gap-1">
          <a href="#" onclick="showImg('${imgUrl1}'); return false;" class="text-blue-500 hover:text-blue-700 underline text-xs font-semibold whitespace-nowrap"><i class="fas fa-image mr-1"></i>ดูรูปที่ 1</a>
          <a href="#" onclick="showImg('${imgUrl2}'); return false;" class="text-purple-500 hover:text-purple-700 underline text-xs font-semibold whitespace-nowrap"><i class="fas fa-images mr-1"></i>ดูรูปที่ 2</a>
        </div>`;
    } else if (imgUrl1) {
      imageLink = `<a href="#" onclick="showImg('${imgUrl1}'); return false;" class="text-blue-500 hover:text-blue-700 underline text-xs font-semibold whitespace-nowrap"><i class="fas fa-image mr-1"></i>ดูรูปภาพ</a>`;
    } else if (imgUrl2) {
      imageLink = `<a href="#" onclick="showImg('${imgUrl2}'); return false;" class="text-purple-500 hover:text-purple-700 underline text-xs font-semibold whitespace-nowrap"><i class="fas fa-image mr-1"></i>ดูรูปภาพ</a>`;
    } else {
      imageLink = '<span class="text-gray-400 text-xs">-</span>';
    }

    return `<tr>
      <td class="text-xs text-gray-500">${m.code13||'-'}</td>
      <td class="text-center">${imageLink}</td>
      <td>
        <div class="font-medium text-sm">${m.nameTH||''}</div><div class="text-xs text-gray-400">${m.nameEN||''}</div>
      </td>
      <td><span class="badge" style="background:#dbeafe;color:#1d4ed8">${m.category||'ยา'}</span></td>
      <td class="text-blue-600 font-bold">${m.stockInner||0}</td>
      <td class="text-orange-600 font-bold">${m.stockOuter||0}</td>
      <td class="${isLow?'text-red-600 font-bold pulse':''}">${m.stock||0}${isLow?' ⚠️':''}</td>
      <td class="text-xs text-gray-500">${m.unit||''}</td>
      <td class="text-xs">฿${Number(m.price||0).toLocaleString()}</td>
      <td class="text-xs text-gray-500">${m.minStock||0}</td>
      <td class="no-print"><div class="flex gap-1">
        <button class="neu-btn p-1 px-2 text-blue-500 text-xs" onclick="editMedicine('${m.id}')"><i class="fas fa-edit"></i></button>
        ${isAdmin?`<button class="neu-btn p-1 px-2 text-red-500 text-xs" onclick="confirmDelete('medicine','${m.id}','${(m.nameTH||'').replace(/'/g,'`')}')"><i class="fas fa-trash"></i></button>`:''}
      </div></td>
    </tr>`;
  }).join('');
}

// ─── TRANSACTIONS & LOT MANAGEMENT [NEW] ─
function getAvailableLots(medId, loc) {
  const lotsMap = {};
  const targetLoc = (loc || 'คลังใน').trim(); // [FIXED] ตัด Space ออกป้องกันปัญหาเทียบค่าไม่ตรง
  
  allTransactions.forEach(t => {
    const tLoc = (t.location || t.warehouse || 'คลังใน').trim();
    if (String(t.medicineId) === String(medId) && tLoc === targetLoc) {
      const key = (t.lot || '-') + '||' + (t.expDate || '');
      if (!lotsMap[key]) {
        lotsMap[key] = { lot: t.lot || '', exp: t.expDate || '', qty: 0 };
      }
      const q = Number(t.qty) || 0;
      if (t.type === 'IN' || t.type === 'RETURN_GOOD') lotsMap[key].qty += q;
      else if (['OUT', 'DEFECT', 'RETURN_DEFECT'].includes(t.type)) lotsMap[key].qty -= q;
    }
  });
  return Object.values(lotsMap).filter(l => l.qty > 0).sort((a,b) => {
    const da = a.exp ? new Date(a.exp) : new Date('9999-12-31');
    const db = b.exp ? new Date(b.exp) : new Date('9999-12-31');
    return da - db;
  });
}

function showLotSelectionModal(lots) {
  const list = document.getElementById('lot-list');
  list.innerHTML = lots.map(l => {
    const expText = l.exp ? formatBE(l.exp) : 'ไม่ระบุ';
    const isNear = l.exp && (new Date(l.exp) - new Date())/(86400000) <= 90;
    return `<div class="p-3 border rounded-xl hover:bg-blue-50 cursor-pointer flex justify-between items-center transition mb-2 ${isNear ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'}" onclick="selectLot('${l.lot}', '${l.exp}')">
      <div>
        <div class="font-bold text-sm text-gray-800">Lot: ${l.lot || '-'}</div>
        <div class="text-xs text-gray-500 mt-1">หมดอายุ: <span class="${isNear?'text-red-500 font-semibold':''}">${expText}</span></div>
      </div>
      <div class="text-right">
        <div class="text-xs text-gray-400 mb-1">คงเหลือ</div>
        <div class="font-bold text-blue-600 bg-white px-2 py-1 rounded shadow-sm border">${l.qty}</div>
      </div>
    </div>`;
  }).join('');
  document.getElementById('lot-modal').style.display = 'flex';
}

function closeLotModal() {
  document.getElementById('lot-modal').style.display = 'none';
}

function selectLot(lot, exp) {
  // เช็คว่าเปิด Modal มาจากหน้า "ย้ายยา" หรือหน้า "เบิกจ่ายปกติ"
  if (document.getElementById('panel-move').classList.contains('open')) {
    document.getElementById('move-lot').value = lot !== '-' ? lot : '';
    document.getElementById('move-exp').value = exp;
  } else {
    document.getElementById('tx-lot').value = lot !== '-' ? lot : '';
    document.getElementById('tx-exp').value = exp;
  }
  closeLotModal();
  toast('เลือก Lot ข้อมูลสำเร็จ', 'success', 1500);
}

function onMedSelect(sel) {
  const med = allMedicines.find(m=>m.id===sel.value);
  if (!med) { document.getElementById('tx-stock-info').style.display='none'; return; }

  const loc = document.getElementById('tx-location').value;
  
  // [FIX] เลิกคำนวณเอง แต่ให้ดึงยอดที่ Backend คำนวณให้แล้วมาโชว์เลย (รับประกันว่าตรงกับหน้าคลังยา 100%)
  const totalLocStock = loc === 'คลังนอก' ? (med.stockOuter || 0) : (med.stockInner || 0);

  document.getElementById('tx-current-stock').textContent = totalLocStock;
  document.getElementById('tx-unit-show').textContent = med.unit||'';
  document.getElementById('tx-stock-info').style.display = 'block';
  if (!document.getElementById('tx-price').value) document.getElementById('tx-price').value = med.price||'';
  updateTotal();

  const type = document.getElementById('tx-type').value;
  const txId = document.getElementById('tx-id').value;
  
  // แจ้งผู้ใช้ว่าระบบใช้ Auto FEFO (ซ่อนหรือ Disable ช่อง Lot ชั่วคราว)
  if (!txId && (type === 'OUT' || type === 'DEFECT')) {
     document.getElementById('tx-lot').value = 'Auto (FEFO)';
     document.getElementById('tx-exp').value = '';
     document.getElementById('tx-lot').readOnly = true;
     document.getElementById('tx-exp').readOnly = true;
     document.getElementById('tx-lot').style.backgroundColor = '#f8fafc';
     document.getElementById('tx-exp').style.backgroundColor = '#f8fafc';
  } else if (!txId && (type === 'IN' || type === 'RETURN_GOOD')) {
     document.getElementById('tx-lot').value = '';
     document.getElementById('tx-lot').readOnly = false;
     document.getElementById('tx-exp').readOnly = false;
     document.getElementById('tx-lot').style.backgroundColor = '';
     document.getElementById('tx-exp').style.backgroundColor = '';
  }
}

// ─── TRANSACTIONS (LOAD) ─────────────────
async function loadTransactions(view) {
  const isReceive = view === 'receive';
  const types = isReceive ? ['IN'] : ['OUT','RETURN_GOOD','RETURN_DEFECT','DEFECT'];
  const fromEl = document.getElementById(isReceive?'tx-date-from':'tx-out-from');
  const toEl   = document.getElementById(isReceive?'tx-date-to':'tx-out-to');
  const filters = {};
  if (fromEl?.value) filters.dateFrom = fromEl.value + '-01';
  if (toEl?.value)   filters.dateTo   = toEl.value   + '-31';
  const tbody = document.getElementById(isReceive?'receive-tbody':'dispense-tbody');
  tbody.innerHTML = `<tr><td colspan="${isReceive?12:11}" class="text-center py-6 text-gray-400">กำลังโหลด...</td></tr>`;
  try {
    const res = await gas('getTransactions', filters);
    if (!res.ok) { toast(res.message,'error'); return; }
    
    // [FIXED] นำข้อมูลที่เพิ่งโหลดมาอัปเดตใส่ allTransactions แบบ 100% 
    // เพื่อป้องกันบั๊กหาข้อมูลไม่เจอเวลาเซฟหรือกด Edit 
    if (res.data) {
        res.data.forEach(fetchedTx => {
            const idx = allTransactions.findIndex(x => String(x.id) === String(fetchedTx.id));
            if (idx >= 0) allTransactions[idx] = fetchedTx;
            else allTransactions.push(fetchedTx);
        });
    }

    let data = res.data.filter(t => types.includes(t.type));
    
    const cat = isReceive ? (document.getElementById('rx-cat-filter')?.value||'') : (document.getElementById('out-cat-filter')?.value||'');
    if (cat) {
      data = data.filter(t => {
        const med = allMedicines.find(m => String(m.id) === String(t.medicineId));
        return med && med.category === cat;
      });
    }

    if (data.length===0) { tbody.innerHTML = `<tr><td colspan="${isReceive?12:11}" class="text-center py-6 text-gray-400">ไม่พบรายการ</td></tr>`; return; }
    const typeLabel = {IN:'รับเข้า',OUT:'เบิกจ่าย',RETURN_GOOD:'คืน(สมบูรณ์)',RETURN_DEFECT:'คืน(ชำรุด)',DEFECT:'ชำรุด'};
    const typeColor = {IN:'#dcfce7;color:#166534',OUT:'#dbeafe;color:#1d4ed8',RETURN_GOOD:'#fef9c3;color:#713f12',RETURN_DEFECT:'#fee2e2;color:#b91c1c',DEFECT:'#fee2e2;color:#b91c1c'};
    if (isReceive) {
      tbody.innerHTML = data.map(t => `<tr>
        <td><input type="checkbox" class="chk-rx" value="${t.id}" onchange="updateSelRx()"/></td>
        <td class="text-xs">${formatBE(t.date)}</td><td>${t.nameTH||''}</td>
        <td class="text-xs">${t.lot||''}</td>
        <td class="text-xs ${new Date(t.expDate)<new Date()?'text-red-500':''}">${formatBE(t.expDate)}</td>
        <td class="text-right font-semibold">${t.qty||0}</td>
        <td class="text-xs">${(allMedicines.find(m=>m.id===t.medicineId)||{}).unit||''}</td>
        <td class="text-xs text-right">฿${Number(t.price||0).toLocaleString()}</td>
        <td class="text-xs text-right font-semibold">฿${Number(t.totalPrice||0).toLocaleString()}</td>
        <td><span class="badge" style="background:#dbeafe;color:#1d4ed8">${t.location||'คลังใน'}</span></td>
        <td class="text-xs">${t.receivedBy||''}</td>
        <td class="no-print"><div class="flex gap-1">
          <button class="neu-btn p-1 px-2 text-blue-500 text-xs" onclick="editTransaction('${t.id}','IN')"><i class="fas fa-edit"></i></button>
          <button class="neu-btn p-1 px-2 text-red-500 text-xs" onclick="confirmDelete('transaction','${t.id}','รายการ ${t.date}')"><i class="fas fa-trash"></i></button>
        </div></td></tr>`).join('');
    } else {
      tbody.innerHTML = data.map(t => `<tr>
        <td><input type="checkbox" class="chk-out" value="${t.id}" onchange="updateSelOut()"/></td>
        <td class="text-xs">${formatBE(t.date)}</td>
        <td><span class="badge" style="background:${typeColor[t.type]||'#f1f5f9;color:#334155'}">${typeLabel[t.type]||t.type}</span></td>
        <td>${t.nameTH||''}</td><td class="text-xs">${t.lot||''}</td>
        <td class="text-right font-semibold">${t.qty||0}</td>
        <td class="text-xs">${(allMedicines.find(m=>m.id===t.medicineId)||{}).unit||''}</td>
        <td><span class="badge" style="background:${t.location==='คลังใน'?'#dbeafe;color:#1d4ed8':'#ffedd5;color:#c2410c'}">${t.location||'คลังใน'}</span></td>
        <td class="text-xs">${t.requestBy||''}</td>
        <td class="text-xs">${t.note||''}</td>
        <td class="no-print"><div class="flex gap-1">
          <button class="neu-btn p-1 px-2 text-blue-500 text-xs" onclick="editTransaction('${t.id}','${t.type}')"><i class="fas fa-edit"></i></button>
          <button class="neu-btn p-1 px-2 text-red-500 text-xs" onclick="confirmDelete('transaction','${t.id}','รายการ ${t.date}')"><i class="fas fa-trash"></i></button>
        </div></td></tr>`).join('');
    }
  } catch(e) { toast('โหลดข้อมูลล้มเหลว','error'); }
}

// ─── REPORT ──────────────────────────────
async function loadReport() {
  const yr = document.getElementById('rpt-year').value;
  const mo = document.getElementById('rpt-month').value;
  const tbody = document.getElementById('report-tbody');
  tbody.innerHTML = '<tr><td colspan="11" class="text-center py-6 text-gray-400">กำลังโหลด...</td></tr>';
  try {
    const res = await gas('getMonthlyReport', Number(yr), Number(mo));
    if (!res.ok) { toast(res.message,'error'); return; }
    reportData = res.data;
    const mnTH = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'][mo];
    document.getElementById('rpt-print-header').innerHTML = `<strong>รายงานสรุปยา เดือน${mnTH} ${Number(yr)+543}</strong>`;
    
    filterReport();
  } catch(e) { toast('โหลดรายงานล้มเหลว','error'); }
}

function filterReport() {
  const cat = document.getElementById('rpt-cat-filter')?.value||'';
  let data = cat && reportData ? reportData.filter(m => m.category === cat) : (reportData || []);
  const tbody = document.getElementById('report-tbody');
  
  if(data.length === 0) {
     tbody.innerHTML = '<tr><td colspan="11" class="text-center py-6 text-gray-400">ไม่มีข้อมูล</td></tr>';
     document.getElementById('rpt-summary').style.display='none';
     return;
  }
  
  let totIn=0,totOut=0,totInVal=0,totOutVal=0;
  tbody.innerHTML = data.map(m => {
    totIn+=m.inQty; totOut+=m.outQty; totInVal+=m.inValue; totOutVal+=m.outValue;
    return `<tr><td class="text-xs">${m.code13||''}</td><td>${m.nameTH}</td>
      <td class="text-xs">${m.category||''}</td><td class="text-xs">${m.unit||''}</td>
      <td class="text-right text-green-600 font-semibold">${m.inQty}</td>
      <td class="text-right text-red-500 font-semibold">${m.outQty}</td>
      <td class="text-right text-yellow-600">${m.retQty}</td>
      <td class="text-right text-orange-500">${m.defQty}</td>
      <td class="text-right font-bold">${m.stock}</td>
      <td class="text-right text-xs">฿${m.inValue.toLocaleString()}</td>
      <td class="text-right text-xs">฿${m.outValue.toLocaleString()}</td></tr>`;
  }).join('');
  
  document.getElementById('rpt-summary').style.display='grid';
  setText('rpt-total-in', totIn); setText('rpt-total-out', totOut);
  setText('rpt-val-in', '฿'+totInVal.toLocaleString()); setText('rpt-val-out', '฿'+totOutVal.toLocaleString());
}

// ─── FORECAST ────────────────────────────
async function loadForecast() {
  const tbody = document.getElementById('forecast-tbody');
  tbody.innerHTML = '<tr><td colspan="10" class="text-center py-6 text-gray-400">กำลังคำนวณ...</td></tr>';
  try {
    const res = await gas('getForecast');
    if (!res.ok) { toast(res.message,'error'); return; }
    forecastData = res.data;
    
    filterForecast();
    toast(`คำนวณเสร็จสิ้น`, 'info');
  } catch(e) { toast('คำนวณล้มเหลว','error'); }
}

function filterForecast() {
  const cat = document.getElementById('fc-cat-filter')?.value||'';
  let data = cat && forecastData ? forecastData.filter(m => m.category === cat) : (forecastData || []);
  const tbody = document.getElementById('forecast-tbody');
  
  if (data.length===0) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center py-6 text-green-600"><i class="fas fa-check-circle mr-1"></i>ไม่พบรายการ หรือสต๊อกเพียงพอ</td></tr>';
    return;
  }
  
  tbody.innerHTML = data.map(m => `<tr>
    <td class="text-xs">${m.code13||''}</td><td>${m.nameTH}</td>
    <td class="text-xs">${m.unit||''}</td>
    <td class="text-xs text-right">฿${Number(m.price||0).toLocaleString()}</td>
    <td class="text-xs text-right">${m.unitPerBox||1}</td>
    <td class="text-right font-semibold">${m.stock}</td>
    <td class="text-right">${m.avgOut}/เดือน</td>
    <td class="text-right">${m.target2months}</td>
    <td class="text-right text-orange-600 font-bold">${m.toOrder}</td>
    <td class="text-right text-blue-600 font-bold">${m.boxes}</td>
  </tr>`).join('');
}

// ─── USERS ───────────────────────────────
async function renderUsers() {
  const tbody = document.getElementById('users-tbody');
  try {
    const res = await gas('getUsers');
    if (!res.ok) { toast(res.message,'error'); return; }
    allUsers = res.data;
    tbody.innerHTML = allUsers.map(u => {
      let imgUrl = u.imageUrl ? u.imageUrl.replace('drive.google.com/uc?id=', 'lh3.googleusercontent.com/d/') : '';
      const iconClass = u.role === 'admin' ? 'fa-user-shield' : 'fa-user';
      
      const defaultIcon = `<div style="width:28px;height:28px;border-radius:6px;background:linear-gradient(135deg,#4facfe,#ff9a9e);display:flex;align-items:center;justify-content:center;color:#fff;font-size:.8rem;"><i class="fas ${iconClass}"></i></div>`;
      const imgHtml = imgUrl ? `<img src="${imgUrl}" style="width:28px;height:28px;border-radius:6px;object-fit:cover;display:block;" onerror="this.outerHTML='${defaultIcon.replace(/'/g, "\\'")}'"/>` : defaultIcon;
      
      return `<tr>
        <td class="text-xs">${u.id}</td>
        <td class="flex items-center gap-2">
          ${imgHtml}
          ${u.username}
        </td>
        <td>${u.name||''}</td>
        <td><span class="badge" style="background:${u.role==='admin'?'#ede9fe;color:#7c3aed':'#e0f2fe;color:#075985'}">${u.role==='admin'?'Admin':'User'}</span></td>
        <td class="text-xs">${u.phone||''}</td>
        <td><span class="badge" style="background:${u.active!==false&&u.active!=='FALSE'?'#dcfce7;color:#166534':'#fee2e2;color:#b91c1c'}">${u.active!==false&&u.active!=='FALSE'?'ใช้งาน':'ระงับ'}</span></td>
        <td class="no-print"><div class="flex gap-1">
          <button class="neu-btn p-1 px-2 text-blue-500 text-xs" onclick="editUser('${u.id}')"><i class="fas fa-edit"></i></button>
          <button class="neu-btn p-1 px-2 text-red-500 text-xs" onclick="confirmDelete('user','${u.id}','${(u.name||u.username||'').replace(/'/g,'`')}')"><i class="fas fa-trash"></i></button>
        </div></td>
      </tr>`;
    }).join('');
  } catch(e) { toast('โหลดผู้ใช้ล้มเหลว','error'); }
}

// ─── SETTINGS (Line Messaging API) ───────
async function loadSettingsForm() {
  try {
    const res = await gas('getSettings');
    if (!res.ok) return;
    appSettings = res.data;
    const fields = ['storeName','storeAddress','storePhone','storeLogo','adminName','adminPhone','adminEmail',
      'adminPassword','lineChannelAccessToken','lineChannelSecret','lineBotName','lineChatId', 'lineAdminId',
      'telegramToken','telegramBotName','telegramChatId','notifyDays','geminiApiKey','creditText','notifyAdminActive','notifyGroupActive','marqueeText','marqueeImgs','floatingImg'];
    fields.forEach(k => { const el=document.getElementById('cfg-'+k); if(el) el.value=appSettings[k]||(k.includes('Active')?'TRUE':''); });
    
    // [NEW] โหลด preview โลโก้
    const logoUrl = appSettings.storeLogo ? appSettings.storeLogo.replace('drive.google.com/uc?id=', 'lh3.googleusercontent.com/d/') : '';
    const prevEl = document.getElementById('cfg-storeLogo-prev');
    if (logoUrl && prevEl) {
      prevEl.src = logoUrl;
      prevEl.style.display = 'block';
    }
    const credit = document.getElementById('cfg-credit-display');
    if (credit) credit.textContent = appSettings.creditText||'Credit By Ritwet_hospital_DrugStock';
    updateLineStatusBadge(null);

    // ดึงโปรไฟล์ Bot ที่เคยบันทึกไว้
    try { savedLineBots = JSON.parse(appSettings.lineBotsList || '[]'); } catch(e) { savedLineBots = []; }
    renderBotDropdown();

  } catch(e) { toast('โหลดการตั้งค่าล้มเหลว','error'); }
}

async function saveSettings() {
  // [NEW] อัปโหลดโลโก้ก่อน ถ้ามีการเลือกไฟล์ใหม่
  const logoFile = document.getElementById('cfg-storeLogo-file');
  if (logoFile && logoFile.files.length > 0) {
    toast('กำลังอัปโหลดโลโก้...', 'info', 2000);
    const uploaded = await uploadImageFE('cfg-storeLogo-file');
    if (uploaded) {
      document.getElementById('cfg-storeLogo').value = uploaded;
    }
  }
  
  const fields = ['storeName','storeAddress','storePhone','storeLogo','adminName','adminPhone','adminEmail',
    'adminPassword','lineChannelAccessToken','lineChannelSecret','lineBotName','lineChatId', 'lineAdminId',
    'telegramToken','telegramBotName','telegramChatId','notifyDays','geminiApiKey','creditText','notifyAdminActive','notifyGroupActive','marqueeText','marqueeImgs','floatingImg'];
  const data = {};
  fields.forEach(k => { const el=document.getElementById('cfg-'+k); if(el) data[k]=el.value; });
  try {
    const res = await gas('saveSettings', data);
    if (res.ok) { appSettings={...appSettings,...data}; applySettings(); toast('บันทึกการตั้งค่าสำเร็จ','success'); }
    else toast(res.message,'error');
  } catch(e) { toast('บันทึกล้มเหลว','error'); }
}

function updateLineStatusBadge(status) {
  const badge = document.getElementById('line-status-badge');
  if (!badge) return;
  if (status === null) {
    badge.className = 'line-status disconnected';
    badge.innerHTML = '<i class="fas fa-circle mr-1" style="font-size:.5rem"></i>ยังไม่ทดสอบ';
  } else if (status === true) {
    badge.className = 'line-status connected';
    badge.innerHTML = '<i class="fas fa-circle mr-1" style="font-size:.5rem"></i>เชื่อมต่อแล้ว';
  } else {
    badge.className = 'line-status disconnected';
    badge.innerHTML = '<i class="fas fa-circle mr-1" style="font-size:.5rem"></i>เชื่อมต่อล้มเหลว';
  }
}

async function testLineConn() {
  const token = document.getElementById('cfg-lineChannelAccessToken')?.value?.trim();
  if (!token) { toast('กรุณาใส่ Channel Access Token ก่อน','warning'); return; }
  toast('กำลังทดสอบการเชื่อมต่อ Line...','info',3000);
  try {
    await gas('saveSettings', { lineChannelAccessToken: token });
    const res = await gas('testLineConnection');
    if (res.ok) {
      updateLineStatusBadge(true);
      toast(`✅ เชื่อมต่อสำเร็จ! Bot: ${res.botName}`, 'success', 5000);
      if (document.getElementById('cfg-lineBotName')) {
        document.getElementById('cfg-lineBotName').value = res.botName||'';
        
        // อัปเดตชื่อในลิสต์ดรอปดาวน์ให้ตรงกับชื่อจริงของ Bot ทันที
        const idx = document.getElementById('cfg-savedBots').value;
        if(idx !== '' && savedLineBots[idx]) {
            savedLineBots[idx].name = res.botName;
            gas('saveSettings', { lineBotsList: JSON.stringify(savedLineBots) });
            renderBotDropdown();
            document.getElementById('cfg-savedBots').value = idx;
        }
      }
    } else {
      updateLineStatusBadge(false);
      toast('❌ ' + res.message, 'error', 5000);
    }
  } catch(e) { updateLineStatusBadge(false); toast('ทดสอบล้มเหลว: '+e.message,'error'); }
}

async function sendLineTest() {
  const chatId = document.getElementById('cfg-lineChatId')?.value?.trim();
  if (!chatId) { toast('กรุณาใส่ User ID / Group ID (กลุ่ม) ก่อน','warning'); return; }
  toast('กำลังส่งข้อความทดสอบ...','info',2000);
  try {
    await gas('saveSettings', {
      lineChannelAccessToken: document.getElementById('cfg-lineChannelAccessToken')?.value||'',
      lineChatId: chatId,
      lineAdminId: document.getElementById('cfg-lineAdminId')?.value||''
    });
    const res = await gas('sendAnnouncement', '🧪 ทดสอบการส่งข้อความจากระบบคลังยา รพ.สต.\n✅ การเชื่อมต่อ Line Messaging API ทำงานปกติ');
    
    if (res.ok) {
      toast('✅ ส่งข้อความทดสอบเรียบร้อย! (เช็คในไลน์ได้เลย)','success');
    } else {
      toast('❌ ส่งล้มเหลว: ' + res.error, 'error', 6000); 
    }
  } catch(e) { toast('ส่งล้มเหลว: '+e.message,'error'); }
}

// ================= BOT PROFILE MANAGEMENT =================

function renderBotDropdown() {
  const sel = document.getElementById('cfg-savedBots');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- เลือก Bot ที่บันทึกไว้ --</option>' +
    savedLineBots.map((b, i) => `<option value="${i}">${b.name || 'Bot '+(i+1)}</option>`).join('');
}

function loadBotProfile() {
  const idx = document.getElementById('cfg-savedBots').value;
  if (idx === '') { toast('กรุณาเลือก Bot จากเมนูก่อน', 'warning'); return; }
  const b = savedLineBots[idx];
  document.getElementById('cfg-lineChannelAccessToken').value = b.token || '';
  document.getElementById('cfg-lineChannelSecret').value = b.secret || '';
  document.getElementById('cfg-lineAdminId').value = b.adminId || '';
  document.getElementById('cfg-lineChatId').value = b.chatId || '';
  document.getElementById('cfg-lineBotName').value = b.name || '';
  
  updateLineStatusBadge(null); // รีเซ็ตสถานะ
  toast('โหลดข้อมูล Bot สำเร็จ! กรุณากด "ทดสอบ Token" และ "บันทึกการตั้งค่าระบบ"', 'info', 4000);
}

async function saveNewBotProfile() {
  const token = document.getElementById('cfg-lineChannelAccessToken').value.trim();
  const secret = document.getElementById('cfg-lineChannelSecret').value.trim();
  const adminId = document.getElementById('cfg-lineAdminId').value.trim();
  const chatId = document.getElementById('cfg-lineChatId').value.trim();
  let name = document.getElementById('cfg-lineBotName').value.trim() || 'Bot (รอทดสอบ Token)';

  if (!token) { toast('กรุณากรอก Channel Access Token ก่อนบันทึก', 'warning'); return; }

  const existsIdx = savedLineBots.findIndex(b => b.token === token);
  if (existsIdx >= 0) {
    savedLineBots[existsIdx] = { name, token, secret, adminId, chatId };
    toast('อัปเดตข้อมูล Bot ตัวเลือกสำเร็จ', 'success');
  } else {
    savedLineBots.push({ name, token, secret, adminId, chatId });
    toast('เพิ่ม Bot ลงในตัวเลือกสำเร็จ', 'success');
  }

  try {
    await gas('saveSettings', { lineBotsList: JSON.stringify(savedLineBots) });
    appSettings.lineBotsList = JSON.stringify(savedLineBots);
    renderBotDropdown();
    document.getElementById('cfg-savedBots').value = existsIdx >= 0 ? existsIdx : (savedLineBots.length - 1);
  } catch(e) { toast('บันทึกตัวเลือกล้มเหลว', 'error'); }
}

async function deleteBotProfile() {
  const idx = document.getElementById('cfg-savedBots').value;
  if (idx === '') { toast('กรุณาเลือก Bot ที่ต้องการลบ', 'warning'); return; }
  
  showConfirmModal('ต้องการลบ Bot นี้ออกจากตัวเลือกใช่หรือไม่?', 'ลบ Bot', async () => {
    savedLineBots.splice(idx, 1);
    try {
      await gas('saveSettings', { lineBotsList: JSON.stringify(savedLineBots) });
      appSettings.lineBotsList = JSON.stringify(savedLineBots);
      renderBotDropdown();
      clearForm(['cfg-lineChannelAccessToken', 'cfg-lineChannelSecret', 'cfg-lineAdminId', 'cfg-lineChatId', 'cfg-lineBotName']);
      updateLineStatusBadge(null);
      toast('ลบ Bot ออกจากตัวเลือกสำเร็จ', 'success');
    } catch(e) { toast('ลบล้มเหลว', 'error'); }
  });
}

async function forceAuthorize() {
  try { const res=await gas('forceAuthorize'); toast(res.ok?'ปลดล็อคสิทธิ์สำเร็จ':'ปลดล็อคล้มเหลว: '+res.error, res.ok?'success':'warning'); }
  catch(e) { toast('เกิดข้อผิดพลาด','error'); }
}

async function setupDatabase() {
  try { const res=await gas('setupDatabase'); toast(res.message, res.ok?'success':'error'); }
  catch(e) { toast('เกิดข้อผิดพลาด','error'); }
}

async function createTriggers() {
  try { const res=await gas('createTriggers'); toast(res.message, res.ok?'success':'error'); }
  catch(e) { toast('เกิดข้อผิดพลาด','error'); }
}

// ─── SLIDE PANELS ────────────────────────
function openSlidePanel(type, mode, data) {
  closeAllPanels();
  if (type==='medicine') {
    document.getElementById('panel-medicine-title').textContent = mode==='add'?'เพิ่มรายการยา':'แก้ไขรายการยา';
    clearForm(['med-id','med-code13','med-nameTH','med-nameEN','med-price','med-unitPerBox','med-minStock','med-desc']);
    document.getElementById('med-category').value='ยา';
    document.getElementById('med-unit').value='เม็ด';
    if (data) {
      document.getElementById('med-id').value=data.id||'';
      document.getElementById('med-code13').value=data.code13||'';
      document.getElementById('med-nameTH').value=data.nameTH||'';
      document.getElementById('med-nameEN').value=data.nameEN||'';
      if (data.category) document.getElementById('med-category').value=data.category;
      if (data.unit) document.getElementById('med-unit').value=data.unit;
      document.getElementById('med-price').value=data.price||'';
      document.getElementById('med-unitPerBox').value=data.unitPerBox||1;
      document.getElementById('med-minStock').value=data.minStock||0;
      document.getElementById('med-desc').value=data.description||'';
      ['prev1','prev2'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
      if(data.imageUrl1){document.getElementById('prev1').src=data.imageUrl1.replace('drive.google.com/uc?id=', 'lh3.googleusercontent.com/d/');document.getElementById('prev1').style.display='block';}
      if(data.imageUrl2){document.getElementById('prev2').src=data.imageUrl2.replace('drive.google.com/uc?id=', 'lh3.googleusercontent.com/d/');document.getElementById('prev2').style.display='block';}
    }
    document.getElementById('panel-medicine').classList.add('open');
  } else if (['receive','dispense','return','defect'].includes(type)) {
    openTransactionPanel(type, data);
  } else if (type==='user') {
    document.getElementById('panel-user-title').textContent = mode==='add'?'เพิ่มผู้ใช้':'แก้ไขผู้ใช้';
    clearForm(['user-id','user-username','user-name','user-phone','user-email']);
    document.getElementById('user-password').value='';
    document.getElementById('user-role').value='user';
    if (data) {
      document.getElementById('user-id').value=data.id||'';
      document.getElementById('user-username').value=data.username||'';
      document.getElementById('user-name').value=data.name||'';
      document.getElementById('user-role').value=data.role||'user';
      document.getElementById('user-phone').value=data.phone||'';
      document.getElementById('user-email').value=data.email||'';
      const prev=document.getElementById('user-prev');
      if(data.imageUrl){prev.src=data.imageUrl.replace('drive.google.com/uc?id=', 'lh3.googleusercontent.com/d/');prev.style.display='block';}else{prev.style.display='none';}
    }
    document.getElementById('panel-user').classList.add('open');
  }
}

function openMovePanel() {
  closeAllPanels();
  document.getElementById('panel-move').classList.add('open');
  document.getElementById('move-qty').value = '';
  document.getElementById('move-note').value = '';
  const sel = document.getElementById('move-medicine');
  sel.innerHTML = '<option value="">-- เลือกยาที่จะย้าย --</option>' + 
                  allMedicines.map(m => `<option value="${m.id}">${m.nameTH} (คลังใน: ${m.stockInner||0})</option>`).join('');
}

function onMoveMedSelect(sel) {
  const medId = sel.value;
  const lotEl = document.getElementById('move-lot');
  const expEl = document.getElementById('move-exp');
  
  if(!medId) return;

  // ไม่ต้องเรียก Modal แล้ว ให้แจ้งว่าเป็น Auto
  if(lotEl) {
      lotEl.value = 'ตัดตาม Lot อัตโนมัติ (FEFO)';
      lotEl.style.color = '#7c3aed';
  }
  if(expEl) {
      expEl.value = ''; 
  }
}

async function submitMoveToOuter() {
  const medId = document.getElementById('move-medicine').value;
  const qty = document.getElementById('move-qty').value;
  
  // เพิ่มการดึงค่า lot และ exp
  const lot = document.getElementById('move-lot')?.value || '';
  const exp = document.getElementById('move-exp')?.value || '';

  if(!medId || !qty) { toast('กรุณาเลือกยาและระบุจำนวน','warning'); return; }
  const med = allMedicines.find(m => m.id === medId);
  showLoading(true);
  try {
    const res = await gas('moveStockToOuter', {
      medicineId: medId, 
      qty: qty, 
      nameTH: med.nameTH, 
      unit: med.unit, 
      lot: lot,           // ส่ง Lot ไปหักล้างในคลังใน
      expDate: exp,       // ส่งวันหมดอายุ ไปอ้างอิงตอนหักคลังใน
      requestBy: currentUser?.name || currentUser?.username || 'ระบบ', 
      note: document.getElementById('move-note').value
    });
    if(res.ok) { toast('ย้ายยาสำเร็จ', 'success'); closeSlidePanel('move'); await loadAllData(); showPage('dispense');}
    else { toast(res.message, 'error'); }
  } catch(e) { toast('ย้ายยาล้มเหลว', 'error'); }
  showLoading(false);
}

function openTransactionPanel(type, data) {
  // เพิ่มคำสั่งนี้เข้าไป เพื่อบังคับอัปเดต Dropdown ยาทุกครั้งที่เปิดฟอร์ม
  populateMedicineDropdowns(); 
  const titles={receive:'รับยาเข้าคลัง',dispense:'เบิกจ่ายยา',return:'คืนยา',defect:'แจ้งชำรุด/หมดอายุ'};
  const txTypes={receive:'IN',dispense:'OUT',return:'RETURN_GOOD',defect:'DEFECT'};
  setText('panel-tx-title', (data?'แก้ไข':'')+titles[type]||type);
  document.getElementById('tx-type').value = txTypes[type]||type;
  clearForm(['tx-id','tx-lot','tx-qty','tx-note','tx-requestBy','tx-receivedBy','tx-defectType']);
  document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('tx-exp').value='';
  document.getElementById('tx-price').value='';
  document.getElementById('tx-total').value='';
  document.getElementById('tx-condition').value='good';

  const isDefect = type==='defect';
  const isReturn = type==='return';
  document.getElementById('tx-field-condition').style.display = isReturn ? 'block' : 'none';
  document.getElementById('tx-field-defect').style.display   = (isDefect||isReturn) ? 'block' : 'none';
  document.getElementById('tx-stock-info').style.display     = 'none';
  
  const locField = document.getElementById('tx-location');
  if(type==='receive') {
      locField.value = 'คลังใน';
  } else if(type==='dispense') {
      locField.value = 'คลังนอก';
  }

  if (currentUser) {
    setText('tx-user-name', currentUser.name||currentUser.username);
    setText('tx-user-role-sm', currentUser.role==='admin'?'Admin':'User');
    const ua = document.getElementById('tx-user-avatar-sm');
    const iconClass = currentUser.role === 'admin' ? 'fa-user-shield' : 'fa-user';
    
    let imgUrl = currentUser.imageUrl ? currentUser.imageUrl.replace('drive.google.com/uc?id=', 'lh3.googleusercontent.com/d/') : '';
    if (imgUrl) ua.innerHTML=`<img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.outerHTML='<i class=\\'fas ${iconClass} text-blue-500\\'></i>'"/>`;
    else ua.innerHTML=`<div style="width:100%;height:100%;background:linear-gradient(135deg,#4facfe,#ff9a9e);display:flex;align-items:center;justify-content:center;color:#fff;"><i class="fas ${iconClass}"></i></div>`;
    document.getElementById('tx-requestBy').value = currentUser.name||currentUser.username||'';
  }

  if (data) {
    document.getElementById('tx-id').value=data.id||'';
    document.getElementById('tx-lot').value=data.lot||'';
    document.getElementById('tx-qty').value=data.qty||'';
    document.getElementById('tx-date').value=data.date||'';
    document.getElementById('tx-exp').value=data.expDate||'';
    document.getElementById('tx-price').value=data.price||'';
    document.getElementById('tx-note').value=data.note||'';
    document.getElementById('tx-requestBy').value=data.requestBy||'';
    document.getElementById('tx-receivedBy').value=data.receivedBy||'';
    document.getElementById('tx-location').value=data.location||'คลังใน';
    const sel=document.getElementById('tx-medicine');
    if (data.medicineId) sel.value=data.medicineId;
  }

  ['tx-qty','tx-price'].forEach(id => document.getElementById(id).addEventListener('input', updateTotal));
  document.getElementById('panel-transaction').classList.add('open');
}

function updateTotal() {
  const q = Number(document.getElementById('tx-qty').value)||0;
  const p = Number(document.getElementById('tx-price').value)||0;
  document.getElementById('tx-total').value = (q*p).toFixed(2);
}

function closeAllPanels() { document.querySelectorAll('.slide-panel').forEach(p=>p.classList.remove('open')); }
function closeSlidePanel(type) {
  const ids={medicine:'panel-medicine',transaction:'panel-transaction',user:'panel-user',move:'panel-move'};
  document.getElementById(ids[type]||'panel-'+type)?.classList.remove('open');
}
function openOCRPanel() { closeAllPanels(); document.getElementById('panel-ocr').classList.add('open'); }

function populateMedicineDropdowns() {
  const sel = document.getElementById('tx-medicine');
  if (!sel) return;
  const val = sel.value;
  sel.innerHTML = '<option value="">-- เลือกรายการยา --</option>'
    + allMedicines.map(m=>`<option value="${m.id}">${m.nameTH}${m.nameEN?' / '+m.nameEN:''}${m.code13?' ('+m.code13+')':''}</option>`).join('');
  if (val) sel.value = val;
}

// ─── SAVE MEDICINE ───────────────────────
async function saveMedicine() {
  const nameTH = document.getElementById('med-nameTH').value.trim();
  if (!nameTH) { toast('กรุณาใส่ชื่อยา','warning'); return; }
  let imageUrl1 = document.getElementById('prev1')?.src||'';
  let imageUrl2 = document.getElementById('prev2')?.src||'';
  if (imageUrl1.startsWith('data:')) { const up1 = await uploadImageFE('med-img1'); if (up1) imageUrl1 = up1; }
  if (imageUrl2.startsWith('data:')) { const up2 = await uploadImageFE('med-img2'); if (up2) imageUrl2 = up2; }
  const data = {
    id: document.getElementById('med-id').value||'',
    code13: document.getElementById('med-code13').value,
    nameTH, nameEN: document.getElementById('med-nameEN').value,
    category: document.getElementById('med-category').value,
    unit: document.getElementById('med-unit').value,
    price: document.getElementById('med-price').value||0,
    unitPerBox: document.getElementById('med-unitPerBox').value||1,
    minStock: document.getElementById('med-minStock').value||0,
    description: document.getElementById('med-desc').value,
    imageUrl1: imageUrl1.startsWith('http')?imageUrl1:'',
    imageUrl2: imageUrl2.startsWith('http')?imageUrl2:''
  };
  try {
    const res = data.id ? await gas('updateMedicine', data) : await gas('addMedicine', data);
    if (res.ok) { toast(data.id?'แก้ไขสำเร็จ':'เพิ่มยาสำเร็จ','success'); closeSlidePanel('medicine'); await renderInventory(); populateMedicineDropdowns(); }
    else { if (res.duplicate) toast(res.message,'warning'); else toast(res.message,'error'); }
  } catch(e) { toast('บันทึกล้มเหลว','error'); }
}

// ─── SAVE TRANSACTION ────────────────────
async function saveTransaction() {
  const medId = document.getElementById('tx-medicine').value;
  const qty   = document.getElementById('tx-qty').value;
  if (!medId || !qty) { toast('กรุณาเลือกยาและใส่จำนวน','warning'); return; }
  const med = allMedicines.find(m=>m.id===medId);
  let imageUrl = '';
  const imgEl = document.getElementById('tx-img');
  if (imgEl && imgEl.files.length>0) { const up = await uploadImageFE('tx-img'); if (up) imageUrl = up; }
  const type = document.getElementById('tx-type').value;
  const condition = document.getElementById('tx-condition')?.value||'';
  const finalType = (type==='RETURN_GOOD' || type==='RETURN_DEFECT') ? (condition==='defect'?'RETURN_DEFECT':'RETURN_GOOD') : type;
  const data = {
    id: document.getElementById('tx-id').value||'',
    type: finalType, medicineId: medId, nameTH: med?.nameTH||'',
    lot: document.getElementById('tx-lot').value, expDate: document.getElementById('tx-exp').value,
    qty: Number(qty), date: document.getElementById('tx-date').value,
    note: document.getElementById('tx-note').value,
    requestBy: document.getElementById('tx-requestBy').value,
    receivedBy: document.getElementById('tx-receivedBy').value,
    price: document.getElementById('tx-price').value||0,
    condition, defectType: document.getElementById('tx-defectType')?.value||'',
    imageUrl, unit: med?.unit||'',
    location: document.getElementById('tx-location').value
  };
  try {
    const res = data.id ? await gas('updateTransaction',data) : await gas('addTransaction',data);
    if (res.ok) {
      toast('บันทึกสำเร็จ','success');
      closeSlidePanel('transaction');
      const view = ['IN'].includes(data.type)?'receive':'dispense';
      
      // ดึงข้อมูลใหม่ทั้งหมด เพื่อให้ allTransactions เป็นปัจจุบันเสมอ
      await loadAllData(); 
      await loadTransactions(view);
      populateMedicineDropdowns();
    } else {
      if (res.duplicate) showConfirmDuplicate(res.message, data);
      else toast(res.message,'error');
    }
  } catch(e) { toast('บันทึกล้มเหลว','error'); }
}

function showConfirmDuplicate(msg, data) {
  showConfirmModal(msg + '\nต้องการบันทึกซ้ำหรือไม่?', 'บันทึกซ้ำ', async () => {
    data.note = (data.note||'') + ' [บันทึกซ้ำ]';
    const r2 = await gas('addTransaction', {...data, forceInsert: true});
    if (r2.ok) toast('บันทึกซ้ำสำเร็จ','success'); else toast(r2.message,'error');
  });
}

// ─── SAVE USER ───────────────────────────
async function saveUser() {
  const username = document.getElementById('user-username').value.trim();
  const name     = document.getElementById('user-name').value.trim();
  if (!username || !name) { toast('กรุณากรอกข้อมูลให้ครบ','warning'); return; }
  let imageUrl = '';
  const imgEl = document.getElementById('user-img');
  if (imgEl && imgEl.files.length>0) { const up = await uploadImageFE('user-img'); if (up) imageUrl = up; }
  else { const prev = document.getElementById('user-prev'); if (prev?.src?.startsWith('http')) imageUrl = prev.src; }
  const data = {
    id: document.getElementById('user-id').value||'', username, name,
    password: document.getElementById('user-password').value||'***',
    role: document.getElementById('user-role').value,
    phone: document.getElementById('user-phone').value,
    email: document.getElementById('user-email').value,
    imageUrl, active: true
  };
  try {
    const res = data.id ? await gas('updateUser',data) : await gas('addUser',data);
    if (res.ok) { toast('บันทึกผู้ใช้สำเร็จ','success'); closeSlidePanel('user'); renderUsers(); }
    else toast(res.message,'error');
  } catch(e) { toast('บันทึกล้มเหลว','error'); }
}

function editMedicine(id) { const m = allMedicines.find(x=>x.id===id); if (m) openSlidePanel('medicine','edit',m); }

function editTransaction(id, type) { 
  // ค้นหาข้อมูล transaction ทั้งหมดจาก id
  let tx = allTransactions.find(x => String(x.id) === String(id));
  if (tx) {
    // ส่งข้อมูลแบบเต็ม (tx) ไปให้ฟอร์ม
    openSlidePanel(type==='IN'?'receive':type==='OUT'?'dispense':type==='DEFECT'?'defect':'return','edit', tx); 
  } else {
    toast('ไม่พบข้อมูลรายการ กรุณารีเฟรชหน้าจอ', 'error');
  }
}

function editUser(id) { const u = allUsers.find(x=>x.id===id); if (u) openSlidePanel('user','edit',u); }

function confirmDelete(type, id, name) {
  showConfirmModal(`ลบ "${name}" ?`, 'ลบ', async ()=>{
    try {
      const fnMap={medicine:'deleteMedicine',transaction:'deleteTransaction',user:'deleteUser'};
      const res = await gas(fnMap[type], id);
      if (res.ok) {
        toast('ลบสำเร็จ','success');
        if(type==='medicine'){renderInventory();populateMedicineDropdowns();}
        else if(type==='transaction'){
           await loadAllData(); // โหลดใหม่เพื่อปรับปรุงสต๊อก
           loadTransactions('receive');
           loadTransactions('dispense');
        }
        else if(type==='user') renderUsers();
      } else toast(res.message,'error');
    } catch(e) { toast('ลบล้มเหลว','error'); }
  });
}

function toggleCheckAll(type) {
  const all=document.getElementById(`chk-all-${type}`).checked;
  document.querySelectorAll(`.chk-${type}`).forEach(c=>c.checked=all);
  type==='rx'?updateSelRx():updateSelOut();
}
function updateSelRx(){
  selectedRxIds=new Set([...document.querySelectorAll('.chk-rx:checked')].map(c=>c.value));
  document.getElementById('batch-actions-rx').style.display=selectedRxIds.size>0?'flex':'none';
}
function updateSelOut(){
  selectedOutIds=new Set([...document.querySelectorAll('.chk-out:checked')].map(c=>c.value));
}
async function deleteSelected(type){
  const ids=type==='rx'?[...selectedRxIds]:[...selectedOutIds];
  if(!ids.length){toast('เลือกรายการก่อน','warning');return;}
  showConfirmModal(`ลบ ${ids.length} รายการที่เลือก?`,'ลบทั้งหมด',async()=>{
    const res=await gas('deleteTransactionBatch',ids);
    if(res.ok){toast(`ลบ ${res.deleted} รายการสำเร็จ`,'success');loadTransactions('receive');loadTransactions('dispense');}
    else toast(res.message,'error');
  });
}

let confirmCallback = null;
function showConfirmModal(msg, btnLabel, cb) {
  document.getElementById('confirm-msg').textContent = msg;
  document.getElementById('confirm-yes').textContent = btnLabel||'ยืนยัน';
  document.getElementById('confirm-modal').style.display = 'flex';
  confirmCallback = cb;
  document.getElementById('confirm-yes').onclick = ()=>{ closeConfirm(); if(confirmCallback) confirmCallback(); };
}
function closeConfirm() { document.getElementById('confirm-modal').style.display='none'; }

function previewImg(input, previewId) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { const img = document.getElementById(previewId); if (img) { img.src = e.target.result; img.style.display='block'; } };
  reader.readAsDataURL(file);
}

async function uploadImageFE(inputId) {
  const input = document.getElementById(inputId);
  if (!input || !input.files.length) return null;
  const file = input.files[0];
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = async e => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxW = 600; let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h*maxW/w); w = maxW; }
        canvas.width=w; canvas.height=h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        try {
          const res = await gas('uploadImage', base64, file.name+'_'+Date.now()+'.jpg');
          if (res.ok) { if(res.warning) toast(res.warning,'warning'); resolve(res.url); }
          else { toast('อัปโหลดรูปล้มเหลว: '+res.message,'warning'); resolve(''); }
        } catch(err) { resolve(''); }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function showImg(url) {
  document.getElementById('img-modal-src').src = url;
  document.getElementById('img-modal').style.display = 'flex';
}

// ── EXCEL BATCH IMPORT / EXPORT ──

function escapeCSV(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  return '"' + str.replace(/"/g, '""') + '"';
}

function exportReceiveTemplate() {
  let csv = '\uFEFFIDระบบ(ห้ามแก้ไข),รหัส13หลัก,ชื่อยา,หน่วย,ราคา/หน่วย,Lot,วันหมดอายุ(YYYY-MM-DD),จำนวนรับเข้า\n';
  allMedicines.forEach(m => {
    const nameTH = (m.nameTH||'').replace(/"/g, '""');
    const unit = (m.unit||'').replace(/"/g, '""');
    csv += `"${m.id}","${m.code13||''}","${nameTH}","${unit}","${m.price||0}","","",0\n`;
  });
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'Template_รับยาเข้าคลัง.csv';
  a.click();
}

function importReceiveExcel(input) {
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const lines = e.target.result.split('\n').filter(line => line.trim().length > 0);
    const items = [];
    
    const parseCSVLine = (text) => {
      let ret = [], val = '', inQuote = false;
      for (let i = 0; i < text.length; i++) {
        let char = text[i];
        if (inQuote) {
          if (char === '"') {
            if (i < text.length - 1 && text[i+1] === '"') { val += '"'; i++; }
            else { inQuote = false; }
          } else { val += char; }
        } else {
          if (char === '"') { inQuote = true; }
          else if (char === ',') { ret.push(val); val = ''; }
          else { val += char; }
        }
      }
      ret.push(val);
      return ret;
    };

    for(let i=1; i<lines.length; i++) {
      const vals = parseCSVLine(lines[i]).map(c => c.trim());
      if(vals.length < 8) continue;
      
      const qty = Number(vals[7]);
      if(qty > 0) {
        items.push({
          type: 'IN',
          location: 'คลังใน',
          medicineId: vals[0], 
          nameTH: vals[2],
          unit: vals[3],
          price: vals[4],
          lot: vals[5] || '',
          expDate: vals[6] || '',
          qty: qty,
          date: new Date().toISOString().split('T')[0],
          receivedBy: currentUser?.name || currentUser?.username || 'ระบบ'
        });
      }
    }
    
    if(items.length === 0) { toast('ไม่มีรายการที่จำนวนรับเข้ามากกว่า 0','warning'); return; }
    
    showLoading(true);
    try {
      const res = await gas('addTransactionBatch', items);
      if(res.ok) { 
        toast(`นำเข้าสำเร็จ ${items.length} รายการ`,'success'); 
        await loadAllData(); 
        showPage('receive'); 
      } else { 
        toast(`นำเข้าล้มเหลว ${res.failCount} รายการ`,'error'); 
      }
    } catch(err) { toast('เกิดข้อผิดพลาดในการเชื่อมต่อระบบ','error'); }
    showLoading(false);
    input.value = ''; 
  };
  reader.readAsText(file, 'utf-8');
}

let ocrItems = [];
async function doOCR() {
  const input = document.getElementById('ocr-img');
  if (!input.files.length) { toast('เลือกภาพก่อน','warning'); return; }
  toast('กำลังอ่านข้อมูล...','info',5000);
  const base64 = await new Promise(resolve => {
    const r=new FileReader(); r.onload=e=>resolve(e.target.result); r.readAsDataURL(input.files[0]);
  });
  try {
    const res = await gas('parseImageToTransactions', base64);
    if (!res.ok || !res.data?.length) { toast(res.message||'ไม่พบรายการ','error'); return; }
    ocrItems = res.data;
    renderOCRTable(ocrItems);
    document.getElementById('ocr-result').style.display='block';
    toast(`พบ ${ocrItems.length} รายการ`,'success');
  } catch(e) { toast('อ่านล้มเหลว','error'); }
}

function renderOCRTable(items) {
  const wrap = document.getElementById('ocr-table-wrap');
  wrap.innerHTML = `<table class="data-table text-xs"><thead><tr><th>ชื่อยา</th><th>รหัส</th><th>Lot</th><th>หมดอายุ</th><th>จำนวน</th><th>หน่วย</th></tr></thead>
  <tbody>${items.map((it,i)=>`<tr>
    <td><input class="form-input text-xs py-1" value="${it.nameTH||''}" onchange="ocrItems[${i}].nameTH=this.value"/></td>
    <td><input class="form-input text-xs py-1" value="${it.code13||''}" onchange="ocrItems[${i}].code13=this.value"/></td>
    <td><input class="form-input text-xs py-1" value="${it.lot||''}" onchange="ocrItems[${i}].lot=this.value"/></td>
    <td><input class="form-input text-xs py-1" type="date" value="${it.expDate||''}" onchange="ocrItems[${i}].expDate=this.value"/></td>
    <td><input class="form-input text-xs py-1" type="number" value="${it.qty||0}" onchange="ocrItems[${i}].qty=Number(this.value)"/></td>
    <td><input class="form-input text-xs py-1" value="${it.unit||''}" onchange="ocrItems[${i}].unit=this.value"/></td>
  </tr>`).join('')}</tbody></table>`;
}

async function saveOCRItems() {
  const rxDate = document.getElementById('ocr-rx-date').value || new Date().toISOString().split('T')[0];
  const rxBy   = document.getElementById('ocr-rx-by').value;
  const txItems = ocrItems.map(it => {
    const med = allMedicines.find(m=>m.code13===it.code13||m.nameTH===it.nameTH)||{};
    return { type:'IN', location:'คลังใน', medicineId: med.id||'', nameTH: it.nameTH||med.nameTH||'',
      lot: it.lot, expDate: it.expDate, qty: it.qty, unit: it.unit||med.unit||'',
      date: rxDate, receivedBy: rxBy||currentUser?.name||'', requestBy:'', price: med.price||0 };
  });
  try {
    const res = await gas('addTransactionBatch', txItems);
    if (res.ok) {
      toast(`บันทึก ${txItems.length} รายการสำเร็จ`,'success');
      document.getElementById('panel-ocr').classList.remove('open');
      await Promise.all([renderInventory(), loadTransactions('receive')]);
    } else toast(`บันทึกล้มเหลว ${res.failCount} รายการ`,'warning');
  } catch(e) { toast('บันทึกล้มเหลว','error'); }
}

function globalSearch(q) {
  const dd = document.getElementById('search-dropdown');
  if (!q || q.length < 2) { dd.style.display='none'; return; }
  const lower = q.toLowerCase();
  const results = allMedicines.filter(m =>
    (m.nameTH||'').toLowerCase().includes(lower)||(m.nameEN||'').toLowerCase().includes(lower)||
    (m.code13||'').includes(q)||(m.category||'').toLowerCase().includes(lower)
  ).slice(0,8);
  if (!results.length) { dd.style.display='none'; return; }
  dd.style.display='block';
  dd.innerHTML = results.map(m => {
    let imgUrl1 = m.imageUrl1 ? m.imageUrl1.replace('drive.google.com/uc?id=', 'lh3.googleusercontent.com/d/') : '';
    return `
    <div class="px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center gap-2 border-b" onclick="goToMedicine('${m.id}')">
      ${imgUrl1?`<img src="${imgUrl1}" style="width:28px;height:28px;border-radius:6px;object-fit:cover"/>`:
        '<div style="width:28px;height:28px;background:#e2e8f0;border-radius:6px;display:flex;align-items:center;justify-content:center"><i class="fas fa-pills text-gray-400 text-xs"></i></div>'}
      <div><div class="text-sm font-medium">${m.nameTH}</div>
      <div class="text-xs text-gray-400">${m.category||''} | สต๊อกรวม: ${m.stock||0} ${m.unit||''}</div></div>
    </div>`
  }).join('');
}

function goToMedicine(id) {
  document.getElementById('search-dropdown').style.display='none';
  document.getElementById('global-search').value='';
  showPage('inventory');
  setTimeout(()=>{ document.getElementById('inv-search').value=(allMedicines.find(m=>m.id===id)||{}).nameTH||''; filterInventory(); },200);
}

document.addEventListener('click', e => {
  if (!e.target.closest('#global-search') && !e.target.closest('#search-dropdown'))
    document.getElementById('search-dropdown').style.display='none';
});

// ─── RESET STOCK ─────────────────────────
async function loadCurrentStockForReset() {
  try {
    const res = await gas('getCurrentStockForReset');
    if (!res.ok) { toast(res.message,'error'); return; }
    resetStockItems = res.data;
    renderResetPreview(resetStockItems);
  } catch(e) { toast('โหลดล้มเหลว','error'); }
}

function renderResetPreview(items) {
  document.getElementById('reset-preview').style.display='block';
  document.getElementById('reset-preview-tbody').innerHTML = items.map((m,i)=>`<tr>
    <td>${m.nameTH}</td>
    <td><input type="number" class="form-input text-xs py-1" style="width:80px" value="${m.qty||0}" onchange="resetStockItems[${i}].qty=Number(this.value)"/></td>
    <td class="text-xs">${m.unit||''}</td>
    <td><button onclick="resetStockItems.splice(${i},1);renderResetPreview(resetStockItems)" class="text-red-400 text-xs"><i class="fas fa-times"></i></button></td>
  </tr>`).join('');
}

function importResetCSV(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) return;
    
    const parseCSVLine = (text) => {
      let ret = [], val = '', inQuote = false;
      for (let i = 0; i < text.length; i++) {
        let char = text[i];
        if (inQuote) {
          if (char === '"') {
            if (i < text.length - 1 && text[i+1] === '"') { val += '"'; i++; }
            else { inQuote = false; }
          } else { val += char; }
        } else {
          if (char === '"') { inQuote = true; }
          else if (char === ',') { ret.push(val); val = ''; }
          else { val += char; }
        }
      }
      ret.push(val);
      return ret;
    };

    const headers = parseCSVLine(lines[0]).map(h => h.trim());
    resetStockItems = [];
    
    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i]).map(v => v.trim());
      const obj = {};
      headers.forEach((h, idx) => obj[h] = vals[idx] || '');
      
      const medId = obj.id || obj['รหัส'] || obj['IDระบบ(ห้ามแก้ไข)'] || '';
      const name = obj.nameTH || obj.name || obj['ชื่อยา'] || '';
      const unit = obj.unit || obj['หน่วย'] || '';
      const qty = Number(obj.stock || obj.qty || obj['คงเหลือ'] || obj['จำนวน'] || obj['จำนวนรับเข้า'] || 0);
      
      if (medId) {
        resetStockItems.push({ medicineId: medId, nameTH: name, unit: unit, qty: qty });
      }
    }
    
    renderResetPreview(resetStockItems);
    toast(`นำเข้า ${resetStockItems.length} รายการ`,'success');
  };
  reader.readAsText(file,'utf-8');
}

async function doResetStock() {
  const pass = document.getElementById('reset-admin-pass').value;
  const date = document.getElementById('reset-date').value;
  if (!pass) { toast('กรุณาใส่รหัสผ่าน','warning'); return; }
  if (!date) { toast('กรุณาระบุวันที่เริ่มต้น','warning'); return; }
  if (!document.getElementById('step1-done').style.display || document.getElementById('step1-done').style.display==='none') {
    toast('กรุณาส่งออกข้อมูลก่อน','warning'); return;
  }
  showConfirmModal('ยืนยันการรีเซ็ตสต๊อก? ข้อมูลธุรกรรมเก่าจะถูกลบทั้งหมด','ยืนยันรีเซ็ต',async()=>{
    try {
      const res = await gas('resetStock', pass, date, resetStockItems);
      if (res.ok) { toast(res.message,'success'); showPage('dashboard'); loadAllData(); }
      else toast(res.message,'error');
    } catch(e) { toast('เกิดข้อผิดพลาด','error'); }
  });
}

// ─── EXPORT ──────────────────────────────
function arrayToCSV(rows, headers) {
  const lines = [];
  lines.push(headers.map(h => `"${HEADER_TH[h] || h}"`).join(','));
  rows.forEach(r => {
    const rowStr = headers.map(h => escapeCSV(r[h])).join(',');
    lines.push(rowStr);
  });
  return lines.join('\n');
}

function downloadText(filename, content) {
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(content);
  a.download = filename; a.click();
}

function getCategoryFilterValue
