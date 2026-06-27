import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut, setPersistence, browserLocalPersistence,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);
await setPersistence(auth, browserLocalPersistence);

/* ============================ Taxonomies ============================ */
const TRANSACTION_TYPES = ["Need", "Want", "Investments", "Savings"];

const TAXONOMY = {
  "Children": {type:"Need", subs:["Activities","Allowance","Medical","Childcare","Clothing","School","Toys","Other"]},
  "Debt": {type:"Need", subs:["Credit cards","Student loans","Auto loans","Taxes","Other"]},
  "Education": {type:"Need", subs:["Tuition","Courses","Certifications","Books","Exams","Other"]},
  "Entertainment/Recreational": {type:"Want", subs:["Books","Concerts/shows","Games","Hobbies","Films/Theatre/Plays","Music","Outdoor activities","Photography","Sport","Gym/Spa","TV","Subscriptions","Other"]},
  "Apareals": {type:"Want", subs:["Clothes","Footwear","Hair/Skin Products and Salons","Laundry/Dry Cleaning","Travel Items/Accessories"]},
  "Everyday": {type:"Need", subs:["Groceries/Daily Items","Restaurants","Cafeteria","Takeaway","Fast Food","Personal supplies","Other"]},
  "Gifts": {type:"Want", subs:["Gifts","Donations (charity)","Other"]},
  "Health/medical": {type:"Need", subs:["Medicines","Optics","Doctors/dental/vision","Specialist care","Pharmacy/Diagnostics","Emergency","Other"]},
  "Home": {type:"Need", subs:["Rent/mortgage/Cook/Maid","Property taxes","Furnishings","Lawn/garden/House hel","Supplies","Maintenance/Bills","Improvements","Moving","Other"]},
  "Insurance": {type:"Need", subs:["Car","Health","Home","Life","Other"]},
  "Pets": {type:"Need", subs:["Food","Vet/medical","Toys","Supplies","Other"]},
  "Technology": {type:"Want", subs:["Domains & hosting","Online services","Hardware","Software","Other"]},
  "Transportation": {type:"Need", subs:["Fuel","Car/Bike payments","Car/Bike Repairs","Registration/license","Supplies","Public transit(Taxi/Auto)","Public transit(Air/Rail/Metro/Bus)","Cycle","Cycle Repairs","Other"]},
  "Travel": {type:"Want", subs:["Airfare/Railway","Hotels","Food","Transportation","Entertainment/Activities","Other"]},
  "Utilities": {type:"Need", subs:["Phone","TV","Internet","Electricity","Heat/gas","Water","Other"]},
  "Investments": {type:"Investments", subs:["FD/RD/Bonds","Gold/Silver","Equity","Mutual Funds","Crypto"]},
  "Other": {type:"Want", subs:["Category 1","Category 2"]}
};
const CATEGORY_NAMES = Object.keys(TAXONOMY);

const INCOME_TAXONOMY = {
  "Wages": {subs:["Pay slip","Tips","Bonus","Commission","Other"]},
  "Other": {subs:["Investment","Interest income","Dividends","Gifts","Refunds","Other"]}
};
const INCOME_CATEGORY_NAMES = Object.keys(INCOME_TAXONOMY);

/* ============================ State ============================ */
let entries = [];        // expenses
let incomeEntries = [];  // income
let budgets = {};
let currentMode = "expense"; // "expense" | "income"
let currentTab = "add";      // expense tabs: add/log/budgets/dashboard/breakdown
                              // income tabs: add/log/summary
let openCats = new Set();
let openIncomeCats = new Set();
let currentUser = null;
let authMode = "signin"; // "signin" | "signup" | "forgot"

const $ = sel => document.querySelector(sel);
const content = $("#content");
const monthPicker = $("#monthPicker");

function todayStr(){ return new Date().toISOString().slice(0,10); }
function thisMonth(){ return new Date().toISOString().slice(0,7); }
function fmt(n){
  n = Math.round(n||0);
  const neg = n < 0;
  const s = Math.abs(n).toLocaleString('en-IN');
  return (neg ? '-₹' : '₹') + s;
}
function badgeClass(type){ return (type||"want").toLowerCase(); }
function showToast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2200);
}
function monthLabel(m){
  const [y,mo] = m.split('-');
  const d = new Date(parseInt(y), parseInt(mo)-1, 1);
  return d.toLocaleDateString('en-US',{month:'long', year:'numeric'});
}

/* ============================ Auth ============================ */
function updateAuthUI(){
  const subtitle = $("#authSubtitle");
  const submitBtn = $("#authSubmitBtn");
  const toggle = $("#authToggle");
  const forgotLink = $("#authForgotLink");
  const passwordField = $("#authPasswordField");

  $("#authError").textContent = "";
  $("#authSuccess").textContent = "";

  if(authMode === "signin"){
    subtitle.textContent = "Sign in to sync your expenses across devices.";
    submitBtn.textContent = "Sign in";
    passwordField.classList.remove('field-hidden');
    forgotLink.classList.remove('field-hidden');
    toggle.innerHTML = 'New here? <a id="authToggleLink">Create an account</a>';
  }else if(authMode === "signup"){
    subtitle.textContent = "Create an account to start syncing your expenses.";
    submitBtn.textContent = "Create account";
    passwordField.classList.remove('field-hidden');
    forgotLink.classList.add('field-hidden');
    toggle.innerHTML = 'Already have an account? <a id="authToggleLink">Sign in</a>';
  }else if(authMode === "forgot"){
    subtitle.textContent = "Enter your email and we'll send a password reset link.";
    submitBtn.textContent = "Send reset link";
    passwordField.classList.add('field-hidden');
    forgotLink.classList.add('field-hidden');
    toggle.innerHTML = '<a id="authToggleLink">Back to sign in</a>';
  }
  document.getElementById('authToggleLink').addEventListener('click', () => {
    authMode = authMode === "signin" ? "signup" : "signin";
    updateAuthUI();
  });
}
$("#authForgotLink").querySelector('a').addEventListener('click', () => {
  authMode = "forgot";
  updateAuthUI();
});
updateAuthUI();

$("#authSubmitBtn").addEventListener('click', async () => {
  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  $("#authError").textContent = "";
  $("#authSuccess").textContent = "";

  if(!email){ $("#authError").textContent = "Enter your email."; return; }

  if(authMode === "forgot"){
    try{
      await sendPasswordResetEmail(auth, email);
      $("#authSuccess").textContent = "Reset email sent — check your inbox.";
    }catch(err){
      $("#authError").textContent = cleanFirebaseError(err);
    }
    return;
  }

  if(!password){ $("#authError").textContent = "Enter your password."; return; }
  try{
    if(authMode === "signup"){
      await createUserWithEmailAndPassword(auth, email, password);
    }else{
      await signInWithEmailAndPassword(auth, email, password);
    }
  }catch(err){
    $("#authError").textContent = cleanFirebaseError(err);
  }
});
function cleanFirebaseError(err){
  return (err.message || "Something went wrong").replace("Firebase: ","").replace(/\(auth\/.*\)\.?/,"").trim();
}

$("#signOutBtn").addEventListener('click', async () => { await signOut(auth); });

onAuthStateChanged(auth, async (user) => {
  if(user){
    currentUser = user;
    $("#authScreen").classList.add('hidden');
    $("#app").classList.remove('hidden');
    $("#userEmailPill").textContent = user.email;
    await init();
  }else{
    currentUser = null;
    $("#app").classList.add('hidden');
    $("#authScreen").classList.remove('hidden');
    authMode = "signin";
    updateAuthUI();
  }
});

/* ============================ Firestore storage ============================ */
function userDocRef(){ return doc(db, "users", currentUser.uid); }

async function loadData(){
  try{
    const snap = await getDoc(userDocRef());
    if(snap.exists()){
      const data = snap.data();
      entries = data.entries || [];
      incomeEntries = data.incomeEntries || [];
      budgets = data.budgets || null;
    }else{
      entries = []; incomeEntries = []; budgets = null;
    }
  }catch(e){
    console.error("load failed", e);
    entries = []; incomeEntries = []; budgets = null;
    showToast("Couldn't load data — check your Firebase config/rules");
  }
  if(!budgets){
    budgets = {};
    CATEGORY_NAMES.forEach(c => budgets[c] = {type: TAXONOMY[c].type, budget: 5000});
    await saveAll();
  }
}
async function saveAll(){
  try{
    await setDoc(userDocRef(), { entries, incomeEntries, budgets }, { merge: true });
  }catch(e){
    console.error("save failed", e);
    showToast("Couldn't save — check your Firebase config/rules");
  }
}

/* ============================ Calc helpers ============================ */
function entriesForMonth(list, month){ return list.filter(e => e.date && e.date.slice(0,7) === month); }
function spentByCategory(month){
  const out = {}; CATEGORY_NAMES.forEach(c => out[c]=0);
  entriesForMonth(entries, month).forEach(e => { out[e.category] = (out[e.category]||0) + Number(e.amount||0); });
  return out;
}
function spentBySub(month){
  const out = {};
  CATEGORY_NAMES.forEach(c => { out[c] = {}; TAXONOMY[c].subs.forEach(s => out[c][s]=0); });
  entriesForMonth(entries, month).forEach(e => {
    if(out[e.category] && e.subcategory in out[e.category]) out[e.category][e.subcategory] += Number(e.amount||0);
  });
  return out;
}
function incomeByCategory(month){
  const out = {}; INCOME_CATEGORY_NAMES.forEach(c => out[c]=0);
  entriesForMonth(incomeEntries, month).forEach(e => { out[e.category] = (out[e.category]||0) + Number(e.amount||0); });
  return out;
}
function incomeBySub(month){
  const out = {};
  INCOME_CATEGORY_NAMES.forEach(c => { out[c] = {}; INCOME_TAXONOMY[c].subs.forEach(s => out[c][s]=0); });
  entriesForMonth(incomeEntries, month).forEach(e => {
    if(out[e.category] && e.subcategory in out[e.category]) out[e.category][e.subcategory] += Number(e.amount||0);
  });
  return out;
}

/* ============================ Mode switch ============================ */
function renderModeSwitch(){
  return `
    <div class="mode-switch" id="modeSwitch">
      <button data-mode="expense" class="${currentMode==='expense'?'active':''}">Expense</button>
      <button data-mode="income" class="${currentMode==='income'?'active':''}">Income</button>
    </div>
  `;
}
function bindModeSwitch(){
  document.querySelectorAll('#modeSwitch button').forEach(btn => {
    btn.addEventListener('click', () => {
      currentMode = btn.dataset.mode;
      currentTab = "add";
      renderTabs();
      render();
    });
  });
}
function renderTabs(){
  const tabsEl = $("#tabs");
  if(currentMode === "expense"){
    tabsEl.innerHTML = `
      <button data-tab="add" class="active">Add Expense</button>
      <button data-tab="log">Log</button>
      <button data-tab="budgets">Budgets</button>
      <button data-tab="dashboard">Dashboard</button>
      <button data-tab="breakdown">Breakdown</button>
    `;
  }else{
    tabsEl.innerHTML = `
      <button data-tab="add" class="active">Add Income</button>
      <button data-tab="log">Income Log</button>
      <button data-tab="summary">Income Summary</button>
    `;
  }
  tabsEl.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      tabsEl.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
  });
}

/* ============================ Render: Add Expense ============================ */
function renderAddExpense(){
  content.innerHTML = `
    ${renderModeSwitch()}
    <div class="panel" style="max-width:640px;">
      <h2>Add an expense</h2>
      <div class="form-row">
        <div class="field">
          <label>Type</label>
          <select id="f-type">${TRANSACTION_TYPES.map(t=>`<option value="${t}">${t}</option>`).join('')}</select>
        </div>
        <div class="field">
          <label>Date</label>
          <input type="date" id="f-date" value="${todayStr()}">
        </div>
      </div>
      <div class="form-row">
        <div class="field" style="flex:2;">
          <label>Particular</label>
          <input type="text" id="f-particular" placeholder="e.g. Big Bazaar grocery run">
        </div>
        <div class="field">
          <label>Amount (₹)</label>
          <input type="number" id="f-amount" min="0" step="1" placeholder="0">
        </div>
      </div>
      <div class="form-row">
        <div class="field"><label>Category</label><select id="f-category"></select></div>
        <div class="field"><label>Subcategory</label><select id="f-subcategory"></select></div>
      </div>
      <button class="btn btn-gold" id="saveEntryBtn">Save expense</button>
    </div>
  `;
  bindModeSwitch();
  const catSel = $("#f-category");
  CATEGORY_NAMES.forEach(c => catSel.appendChild(new Option(c, c)));
  function fillSubs(){
    const subSel = $("#f-subcategory");
    subSel.innerHTML = "";
    TAXONOMY[catSel.value].subs.forEach(s => subSel.appendChild(new Option(s, s)));
  }
  catSel.addEventListener('change', fillSubs);
  fillSubs();

  $("#saveEntryBtn").addEventListener('click', async () => {
    const date = $("#f-date").value;
    const amount = parseFloat($("#f-amount").value);
    const particular = $("#f-particular").value.trim();
    if(!date || !amount || amount<=0){ showToast("Add a date and an amount greater than 0"); return; }
    entries.push({
      id: Date.now()+"-"+Math.random().toString(36).slice(2,7),
      type: $("#f-type").value, date, particular, amount,
      category: catSel.value, subcategory: $("#f-subcategory").value
    });
    await saveAll();
    showToast("Expense saved");
    $("#f-particular").value = ""; $("#f-amount").value = "";
  });
}

/* ============================ Render: Expense Log ============================ */
function renderLog(){
  const sorted = [...entries].sort((a,b)=> (b.date||"").localeCompare(a.date||""));
  let rows = sorted.map(e => `
    <tr>
      <td><span class="badge ${badgeClass(e.type)}">${e.type}</span></td>
      <td>${e.date}</td>
      <td>${e.particular || '<span style="color:#a59c7e">—</span>'}</td>
      <td>${e.category}</td>
      <td>${e.subcategory}</td>
      <td class="num">${fmt(e.amount)}</td>
      <td><button class="btn-danger" data-del="${e.id}">Delete</button></td>
    </tr>
  `).join('');
  content.innerHTML = `
    ${renderModeSwitch()}
    <div class="panel">
      <h2>All expense entries (${entries.length})</h2>
      ${entries.length ? `<div class="table-scroll"><table>
        <thead><tr><th>Type</th><th>Date</th><th>Particular</th><th>Category</th><th>Subcategory</th><th>Amount</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>` : `<div class="empty">No expenses logged yet — add your first one on the "Add Expense" tab.</div>`}
    </div>
  `;
  bindModeSwitch();
  content.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      entries = entries.filter(e => e.id !== btn.dataset.del);
      await saveAll();
      renderLog();
      showToast("Entry deleted");
    });
  });
}

/* ============================ Render: Budgets ============================ */
function renderBudgets(){
  let rows = CATEGORY_NAMES.map(c => `
    <tr>
      <td>${c}</td>
      <td>
        <select data-type="${c}">
          ${TRANSACTION_TYPES.map(t=>`<option value="${t}" ${budgets[c].type===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </td>
      <td><input type="number" data-budget="${c}" value="${budgets[c].budget}" min="0" step="100" style="width:120px; padding:6px 8px; border:1px solid var(--line); border-radius:5px; font-family:'IBM Plex Mono',monospace;"></td>
    </tr>
  `).join('');
  content.innerHTML = `
    ${renderModeSwitch()}
    <div class="panel">
      <h2>Monthly budgets per category</h2>
      <p class="hint">Set your target spend for each category. These drive the "Amount Left" figures on the Dashboard.</p>
      <div class="table-scroll"><table><thead><tr><th>Category</th><th>Type</th><th>Monthly budget (₹)</th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>
  `;
  bindModeSwitch();
  content.querySelectorAll('[data-type]').forEach(sel => {
    sel.addEventListener('change', async () => {
      budgets[sel.dataset.type].type = sel.value;
      await saveAll();
      showToast("Budget updated");
    });
  });
  content.querySelectorAll('[data-budget]').forEach(inp => {
    inp.addEventListener('change', async () => {
      budgets[inp.dataset.budget].budget = parseFloat(inp.value)||0;
      await saveAll();
      showToast("Budget updated");
    });
  });
}

/* ============================ Render: Expense Dashboard ============================ */
function renderDashboard(){
  const month = monthPicker.value || thisMonth();
  const spent = spentByCategory(month);
  let totalSpent=0, totalBudget=0, totalLeft=0;
  let rows = CATEGORY_NAMES.map(c => {
    const s = spent[c]||0, b = budgets[c].budget, left = b - s;
    totalSpent+=s; totalBudget+=b; totalLeft+=left;
    return `<tr>
      <td>${c}</td>
      <td><span class="badge ${badgeClass(budgets[c].type)}">${budgets[c].type}</span></td>
      <td class="num">${fmt(s)}</td>
      <td class="num">${fmt(b)}</td>
      <td class="num ${left<0?'neg':'pos'}">${fmt(left)}</td>
    </tr>`;
  }).join('');

  const monthEntries = entriesForMonth(entries, month).sort((a,b)=> (b.date||"").localeCompare(a.date||"")).slice(0,25);
  const tape = monthEntries.length ? monthEntries.map(e => `
    <div class="tape-row">
      <span>${e.particular || e.subcategory}<br><span class="t-cat">${e.category} · ${e.date}</span></span>
      <span class="t-amt">${fmt(e.amount)}</span>
    </div>
  `).join('') : `<div class="empty" style="color:#8d96a0;">No transactions this month yet</div>`;

  content.innerHTML = `
    ${renderModeSwitch()}
    <div class="grid-2col">
      <div class="panel">
        <h2>Spending summary — ${monthLabel(month)}</h2>
        <div class="table-scroll"><table>
          <thead><tr><th>Category</th><th>Type</th><th>Spent</th><th>Budget</th><th>Left</th></tr></thead>
          <tbody>
            ${rows}
            <tr class="total-row">
              <td colspan="2">Total</td>
              <td class="num">${fmt(totalSpent)}</td>
              <td class="num">${fmt(totalBudget)}</td>
              <td class="num ${totalLeft<0?'neg':'pos'}">${fmt(totalLeft)}</td>
            </tr>
          </tbody>
        </table></div>
      </div>
      <div class="tape-wrap">
        <div class="tape-header">Ledger tape — recent</div>
        <div class="tape">${tape}</div>
      </div>
    </div>
  `;
  bindModeSwitch();
}

/* ============================ Render: Expense Breakdown ============================ */
function renderBreakdown(){
  const month = monthPicker.value || thisMonth();
  const subTotals = spentBySub(month);
  const catTotals = spentByCategory(month);
  let html = CATEGORY_NAMES.map(c => {
    const open = openCats.has(c);
    const subs = TAXONOMY[c].subs.map(s => `
      <div class="bd-sub-row"><span>${s}</span><span class="s-amt">${fmt(subTotals[c][s])}</span></div>
    `).join('');
    return `
      <div class="bd-category" data-cat="${c}">
        <span class="name">${c}</span>
        <span style="display:flex; align-items:center; gap:10px;">
          <span class="num" style="font-weight:700;">${fmt(catTotals[c])}</span>
          <span class="chev ${open?'open':''}">▶</span>
        </span>
      </div>
      <div class="bd-subs" style="display:${open?'block':'none'};">${subs}</div>
    `;
  }).join('');
  content.innerHTML = `${renderModeSwitch()}<div class="panel"><h2>Breakdown by subcategory — ${monthLabel(month)}</h2>${html}</div>`;
  bindModeSwitch();
  content.querySelectorAll('.bd-category').forEach(el => {
    el.addEventListener('click', () => {
      const c = el.dataset.cat;
      openCats.has(c) ? openCats.delete(c) : openCats.add(c);
      renderBreakdown();
    });
  });
}

/* ============================ Render: Add Income ============================ */
function renderAddIncome(){
  content.innerHTML = `
    ${renderModeSwitch()}
    <div class="panel" style="max-width:640px;">
      <h2>Add income</h2>
      <div class="form-row">
        <div class="field">
          <label>Date</label>
          <input type="date" id="f-i-date" value="${todayStr()}">
        </div>
        <div class="field">
          <label>Amount (₹)</label>
          <input type="number" id="f-i-amount" min="0" step="1" placeholder="0">
        </div>
      </div>
      <div class="form-row">
        <div class="field" style="flex:2;">
          <label>Particular</label>
          <input type="text" id="f-i-particular" placeholder="e.g. June salary">
        </div>
      </div>
      <div class="form-row">
        <div class="field"><label>Category</label><select id="f-i-category"></select></div>
        <div class="field"><label>Subcategory</label><select id="f-i-subcategory"></select></div>
      </div>
      <button class="btn btn-gold" id="saveIncomeBtn">Save income</button>
    </div>
  `;
  bindModeSwitch();
  const catSel = $("#f-i-category");
  INCOME_CATEGORY_NAMES.forEach(c => catSel.appendChild(new Option(c, c)));
  function fillSubs(){
    const subSel = $("#f-i-subcategory");
    subSel.innerHTML = "";
    INCOME_TAXONOMY[catSel.value].subs.forEach(s => subSel.appendChild(new Option(s, s)));
  }
  catSel.addEventListener('change', fillSubs);
  fillSubs();

  $("#saveIncomeBtn").addEventListener('click', async () => {
    const date = $("#f-i-date").value;
    const amount = parseFloat($("#f-i-amount").value);
    const particular = $("#f-i-particular").value.trim();
    if(!date || !amount || amount<=0){ showToast("Add a date and an amount greater than 0"); return; }
    incomeEntries.push({
      id: Date.now()+"-"+Math.random().toString(36).slice(2,7),
      date, particular, amount,
      category: catSel.value, subcategory: $("#f-i-subcategory").value
    });
    await saveAll();
    showToast("Income saved");
    $("#f-i-particular").value = ""; $("#f-i-amount").value = "";
  });
}

/* ============================ Render: Income Log ============================ */
function renderIncomeLog(){
  const sorted = [...incomeEntries].sort((a,b)=> (b.date||"").localeCompare(a.date||""));
  let rows = sorted.map(e => `
    <tr>
      <td>${e.date}</td>
      <td>${e.particular || '<span style="color:#a59c7e">—</span>'}</td>
      <td>${e.category}</td>
      <td>${e.subcategory}</td>
      <td class="num">${fmt(e.amount)}</td>
      <td><button class="btn-danger" data-del-i="${e.id}">Delete</button></td>
    </tr>
  `).join('');
  content.innerHTML = `
    ${renderModeSwitch()}
    <div class="panel">
      <h2>All income entries (${incomeEntries.length})</h2>
      ${incomeEntries.length ? `<div class="table-scroll"><table>
        <thead><tr><th>Date</th><th>Particular</th><th>Category</th><th>Subcategory</th><th>Amount</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>` : `<div class="empty">No income logged yet — add your first one on the "Add Income" tab.</div>`}
    </div>
  `;
  bindModeSwitch();
  content.querySelectorAll('[data-del-i]').forEach(btn => {
    btn.addEventListener('click', async () => {
      incomeEntries = incomeEntries.filter(e => e.id !== btn.dataset.delI);
      await saveAll();
      renderIncomeLog();
      showToast("Entry deleted");
    });
  });
}

/* ============================ Render: Income Summary ============================ */
function renderIncomeSummary(){
  const month = monthPicker.value || thisMonth();
  const catTotals = incomeByCategory(month);
  const subTotals = incomeBySub(month);
  let total = 0;
  Object.values(catTotals).forEach(v => total += v);

  let html = INCOME_CATEGORY_NAMES.map(c => {
    const open = openIncomeCats.has(c);
    const subs = INCOME_TAXONOMY[c].subs.map(s => `
      <div class="bd-sub-row"><span>${s}</span><span class="s-amt">${fmt(subTotals[c][s])}</span></div>
    `).join('');
    return `
      <div class="bd-category" data-icat="${c}">
        <span class="name">${c}</span>
        <span style="display:flex; align-items:center; gap:10px;">
          <span class="num" style="font-weight:700;">${fmt(catTotals[c])}</span>
          <span class="chev ${open?'open':''}">▶</span>
        </span>
      </div>
      <div class="bd-subs" style="display:${open?'block':'none'};">${subs}</div>
    `;
  }).join('');

  content.innerHTML = `
    ${renderModeSwitch()}
    <div class="panel">
      <h2>Income summary — ${monthLabel(month)}</h2>
      <p class="hint" style="font-size:14px; color:var(--ink); font-weight:700; margin-bottom:18px;">Total income this month: <span class="pos">${fmt(total)}</span></p>
      ${html}
    </div>
  `;
  bindModeSwitch();
  content.querySelectorAll('[data-icat]').forEach(el => {
    el.addEventListener('click', () => {
      const c = el.dataset.icat;
      openIncomeCats.has(c) ? openIncomeCats.delete(c) : openIncomeCats.add(c);
      renderIncomeSummary();
    });
  });
}

/* ============================ Main render dispatch ============================ */
function render(){
  if(currentMode === "expense"){
    if(currentTab==='add') renderAddExpense();
    else if(currentTab==='log') renderLog();
    else if(currentTab==='budgets') renderBudgets();
    else if(currentTab==='dashboard') renderDashboard();
    else if(currentTab==='breakdown') renderBreakdown();
  }else{
    if(currentTab==='add') renderAddIncome();
    else if(currentTab==='log') renderIncomeLog();
    else if(currentTab==='summary') renderIncomeSummary();
  }
}

monthPicker.addEventListener('change', () => {
  if(currentTab==='dashboard') renderDashboard();
  if(currentTab==='breakdown') renderBreakdown();
  if(currentTab==='summary') renderIncomeSummary();
});

/* ============================ Export to Excel ============================ */
$("#exportBtn").addEventListener('click', () => {
  const month = monthPicker.value || thisMonth();
  const wb = XLSX.utils.book_new();

  const logRows = [["Type","Date","Particular","Amount","Category","Subcategory"]];
  entries.slice().sort((a,b)=>(a.date||"").localeCompare(b.date||"")).forEach(e=>{
    logRows.push([e.type, e.date, e.particular, e.amount, e.category, e.subcategory]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(logRows), "Expense Log");

  const budgetRows = [["Category","Type","Monthly Budget"]];
  CATEGORY_NAMES.forEach(c => budgetRows.push([c, budgets[c].type, budgets[c].budget]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(budgetRows), "Budget");

  const spent = spentByCategory(month);
  const dashRows = [["Category","Type","Spent This Month","Monthly Budget","Amount Left"]];
  let ts=0, tb=0, tl=0;
  CATEGORY_NAMES.forEach(c=>{
    const s=spent[c]||0, b=budgets[c].budget, l=b-s;
    ts+=s; tb+=b; tl+=l;
    dashRows.push([c, budgets[c].type, s, b, l]);
  });
  dashRows.push(["Total","",ts,tb,tl]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dashRows), "Dashboard ("+month+")");

  const subTotals = spentBySub(month);
  const detRows = [["Category / Subcategory","Spent This Month"]];
  CATEGORY_NAMES.forEach(c=>{
    detRows.push([c, spent[c]||0]);
    TAXONOMY[c].subs.forEach(s=> detRows.push(["    "+s, subTotals[c][s]||0]));
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detRows), "Expense Subcategory Detail");

  const incomeLogRows = [["Date","Particular","Amount","Category","Subcategory"]];
  incomeEntries.slice().sort((a,b)=>(a.date||"").localeCompare(b.date||"")).forEach(e=>{
    incomeLogRows.push([e.date, e.particular, e.amount, e.category, e.subcategory]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(incomeLogRows), "Income Log");

  const incCat = incomeByCategory(month);
  const incSub = incomeBySub(month);
  const incRows = [["Category / Subcategory","Income This Month"]];
  let incTotal = 0;
  INCOME_CATEGORY_NAMES.forEach(c=>{
    incTotal += incCat[c]||0;
    incRows.push([c, incCat[c]||0]);
    INCOME_TAXONOMY[c].subs.forEach(s=> incRows.push(["    "+s, incSub[c][s]||0]));
  });
  incRows.push(["Total", incTotal]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(incRows), "Income Summary ("+month+")");

  XLSX.writeFile(wb, "Expense_Logger_Export.xlsx");
  showToast("Excel file downloaded");
});

/* ============================ Init ============================ */
async function init(){
  content.innerHTML = `<div class="loading-note">Loading your ledger…</div>`;
  monthPicker.value = thisMonth();
  await loadData();
  renderTabs();
  render();
}
