// GhostMail - Popup JavaScript
// Author: Nikhil Shah

// Constants
const SERVICES = {
  guerrillamail: {
    name: 'Guerrilla Mail',
    domains: ['grr.la', 'sharklasers.com', 'guerrillamail.net', 'guerrillamail.com'],
    expiry: 3600
  },
  mailgw: {
    name: 'Mail.gw',
    domains: ['mail.gw'],
    expiry: 600
  },
  dropmail: {
    name: 'DropMail.me',
    domains: ['dropmail.me'],
    expiry: 600
  },
  mailtm: {
    name: 'Mail.tm',
    domains: ['mail.tm'],
    expiry: 604800
  },
  tempmaillol: {
    name: 'TempMail.lol',
    domains: ['tempmail.lol'],
    expiry: 3600
  }
};

// State
let state = {
  addresses: {},
  currentAddress: null,
  currentService: 'guerrillamail',
  currentDomain: null,
  refreshInterval: 5,
  recentlyUpdated: [],
  currentPage: 0,
  currentMessageId: null
};

// DOM cache
const elements = {};

// Init
document.addEventListener('DOMContentLoaded', async () => {
  cacheElements();
  await loadState();
  setupEventListeners();
  updateUI();
  startAutoRefresh();
});

/* ---------- Core helpers ---------- */

function cacheElements() {
  [
    'service-selector','domain-selector','refresh-selector','create-btn',
    'addr-page','inbox-page','message-page','addr-list','msg-list',
    'back-to-home','refresh-inbox','back-to-inbox',
    'html-view','raw-view','html-tab-btn','raw-tab-btn','status-bar'
  ].forEach(id => elements[id.replace(/-([a-z])/g, g => g[1].toUpperCase())] = document.getElementById(id));
}

async function loadState() {
  const d = await chrome.storage.local.get([
    'addresses','currentAddress','currentService','currentDomain','refreshInterval','recentlyUpdated'
  ]);
  Object.assign(state, {
    addresses: d.addresses || {},
    currentAddress: d.currentAddress || null,
    currentService: d.currentService || 'guerrillamail',
    currentDomain: d.currentDomain || null,
    refreshInterval: d.refreshInterval || 5,
    recentlyUpdated: d.recentlyUpdated || []
  });
  elements.serviceSelector.value = state.currentService;
  elements.refreshSelector.value = state.refreshInterval.toString();
  updateDomainOptions();
}

async function saveState() {
  await chrome.storage.local.set(state);
}

/* ---------- UI logic ---------- */

function setupEventListeners() {
  elements.serviceSelector.addEventListener('change', handleServiceChange);
  elements.domainSelector.addEventListener('change', () => (state.currentDomain = elements.domainSelector.value, saveState()));
  elements.refreshSelector.addEventListener('change', handleRefreshChange);
  elements.createBtn.addEventListener('click', handleCreateAddress);
  elements.backToHome.addEventListener('click', () => showPage(0));
  elements.refreshInbox.addEventListener('click', refreshCurrentMessages);
  elements.backToInbox.addEventListener('click', () => showPage(1));
  elements.htmlTabBtn.addEventListener('click', () => setActiveTab('html'));
  elements.rawTabBtn.addEventListener('click', () => setActiveTab('raw'));
}

function updateUI() {
  showPage(state.currentPage);
  updateAddressList();
  if (state.currentPage === 1) updateMessageList();
}

function showPage(i) {
  state.currentPage = i;
  ['addrPage','inboxPage','messagePage'].forEach(p => elements[p].classList.add('hidden'));
  ['addrPage','inboxPage','messagePage'][i] && elements[['addrPage','inboxPage','messagePage'][i]].classList.remove('hidden');
}

function updateDomainOptions() {
  elements.domainSelector.innerHTML = '';
  SERVICES[state.currentService].domains.forEach(d => {
    const o = document.createElement('option');
    o.value = o.textContent = d;
    elements.domainSelector.appendChild(o);
  });
  state.currentDomain ||= SERVICES[state.currentService].domains[0];
}

/* ---------- Actions ---------- */

async function handleCreateAddress() {
  showStatus('👻 Creating address...');
  const r = await chrome.runtime.sendMessage({
    action: 'createAddress',
    service: state.currentService,
    domain: state.currentDomain
  });
  if (!r?.success) return showStatus('Failed to create address');
  const { email, token } = r.data;
  state.addresses[email] = { token, service: state.currentService, createdAt: Date.now(), messages: [] };
  state.currentAddress = email;
  await saveState();
  showPage(1);
  refreshCurrentMessages();
}

async function refreshCurrentMessages() {
  if (!state.currentAddress) return;
  await refreshAllMailboxes();
  updateMessageList();
}

async function refreshAllMailboxes() {
  const r = await chrome.runtime.sendMessage({ action: 'refreshMailboxes' });
  if (!r?.success) throw new Error('Refresh failed');
  await loadState();
  updateAddressList();
}

function startAutoRefresh() {
  setInterval(() => state.currentPage === 1 && refreshCurrentMessages(), 1000);
}

function showStatus(m, d = 3000) {
  elements.statusBar.textContent = m;
  setTimeout(() => elements.statusBar.textContent === m && (elements.statusBar.textContent = ''), d);
}
