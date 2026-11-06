/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

// Exercise production TS without importing React Native or a live Firebase project.
function load(file, mocks) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, Date, Set, Map, Promise,
    console: { log() {}, warn() {}, error() {} },
    require(name) {
      assert.ok(name in mocks, `Unexpected dependency ${name}`);
      return mocks[name];
    },
  }, { filename: file });
  return module.exports;
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
function stateStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    getState: () => state,
    setState(update) {
      const previous = state;
      state = { ...state, ...update };
      for (const listener of listeners) listener(state, previous);
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
function orderHarness() {
  const auth = stateStore({ isAuthenticated: true, partner: { id: 'rider-a' }, token: 'jwt-a' });
  const handlers = {};
  let realtime;
  let stopped = 0;
  let response = { success: true, data: [] };
  const api = { getAvailableOrders: async () => response };
  let store;
  const { useOrderStore } = load('store/orders.ts', {
    '@react-native-async-storage/async-storage': {},
    'react-native': { Alert: { alert() {} } },
    zustand: { create: () => (initializer) => {
      store = stateStore({});
      store.setState(initializer(store.setState, store.getState));
      return store;
    } },
    'zustand/middleware': { persist: (init) => init, createJSONStorage() {} },
    '../services/api': { ApiService: api },
    '../services/driverTrackingService': {},
    '../services/realtime.service': { subscribeToDeliveryRealtime: (_id, callbacks) => {
      realtime = callbacks;
      return () => { stopped++; };
    } },
    '../services/socket': { socketService: { connect() {}, on: (event, callback) => { handlers[event] = callback; } } },
    './auth': { useAuthStore: auth },
  });
  return {
    store: useOrderStore, auth, api, handlers,
    setResponse: (next) => { response = next; },
    get realtime() { return realtime; }, get stopped() { return stopped; },
  };
}
const raw = (id = 'offer') => ({ _id: id, createdAt: new Date().toISOString(), status: 'ready' });

test('global pushes and private replays never display payloads before REST eligibility; false-query recovery', async () => {
  const h = orderHarness();
  h.store.getState().initializeSocket();
  h.setResponse({ success: false, data: [raw()] });
  h.handlers['new-delivery-available'](raw());
  await tick();
  assert.equal(h.store.getState().pendingOrder, null);
  h.setResponse({ success: true, data: [] });
  h.store.getState().setIncomingOrder(raw());
  await tick();
  assert.equal(h.store.getState().pendingOrder, null);
  // Backend releases after 180 seconds; client never grants eligibility on its own.
  h.setResponse({ success: true, data: [raw()] });
  await h.store.getState().fetchAvailableOrders();
  assert.equal(h.store.getState().pendingOrder.id, 'offer');
  const received = h.store.getState().pendingOrderReceivedAt;
  h.handlers['new-delivery-available'](raw());
  await tick();
  assert.equal(h.store.getState().pendingOrderReceivedAt, received);
  assert.equal(h.store.getState().missedOrders.length, 0);
});

test('coalesces replay storms and serializes refreshes without replacing a pending ring', async () => {
  const h = orderHarness();
  const first = deferred();
  let calls = 0;
  h.api.getAvailableOrders = () => ++calls === 1 ? first.promise : Promise.resolve({ success: true, data: [raw(), raw('other')] });
  const pending = h.store.getState().fetchAvailableOrders();
  for (let i = 0; i < 20; i++) void h.store.getState().fetchAvailableOrders();
  assert.equal(calls, 1);
  first.resolve({ success: true, data: [raw()] });
  await pending;
  assert.equal(calls, 2);
  assert.equal(h.store.getState().pendingOrder.id, 'offer');
  assert.equal(h.store.getState().missedOrders.length, 1);
});

test('20-minute-old orders ring when first offered or per-order released now, not on stale replays', async () => {
  for (const audience of ['full_time', 'per_order']) {
    const h = orderHarness();
    const oldOrder = { ...raw(audience), createdAt: new Date(Date.now() - 20 * 60000).toISOString() };
    h.setResponse({ success: true, data: [] });
    await h.store.getState().fetchAvailableOrders();
    assert.equal(h.store.getState().pendingOrder, null);
    h.setResponse({ success: true, data: [{ ...oldOrder, offerAvailableAt: new Date().toISOString() }] });
    await h.store.getState().fetchAvailableOrders();
    assert.equal(h.store.getState().pendingOrder.id, audience);
    const received = h.store.getState().pendingOrderReceivedAt;
    await h.store.getState().fetchAvailableOrders();
    assert.equal(h.store.getState().pendingOrderReceivedAt, received);
    h.store.getState().rejectOrder(audience);
    assert.ok(h.store.getState().missedOrders[0].expiresAt.getTime() > Date.now());
    const stale = orderHarness();
    stale.setResponse({ success: true, data: [{ ...oldOrder, offerAvailableAt: new Date(Date.now() - 10 * 60000).toISOString() }] });
    await stale.store.getState().fetchAvailableOrders();
    assert.equal(stale.store.getState().pendingOrder, null);
  }
});

test('order-taken clears pending, available and missed, and invalidates in-flight REST', async () => {
  const h = orderHarness();
  h.setResponse({ success: true, data: [raw()] });
  await h.store.getState().fetchAvailableOrders();
  h.store.getState().rejectOrder('offer');
  const response = deferred();
  let calls = 0;
  h.api.getAvailableOrders = () => ++calls === 1 ? response.promise : Promise.resolve({ success: true, data: [] });
  const pending = h.store.getState().fetchAvailableOrders();
  h.store.getState().removeAvailableOrder('offer');
  assert.equal(h.store.getState().availableOrders.length, 0);
  assert.equal(h.store.getState().missedOrders[0].stillAvailable, false);
  response.resolve({ success: true, data: [raw()] });
  await pending;
  assert.equal(h.store.getState().pendingOrder, null);
  assert.equal(h.store.getState().availableOrders.length, 0);
});

test('REST removal closes a pending offer; failed request can retry successfully', async () => {
  const h = orderHarness();
  h.setResponse({ success: true, data: [raw()] });
  await h.store.getState().fetchAvailableOrders();
  h.setResponse({ success: true, data: [] });
  await h.store.getState().fetchAvailableOrders();
  assert.equal(h.store.getState().pendingOrder, null);
  h.api.getAvailableOrders = async () => { throw new Error('offline'); };
  await h.store.getState().fetchAvailableOrders();
  h.api.getAvailableOrders = async () => ({ success: true, data: [raw('recovered')] });
  await h.store.getState().fetchAvailableOrders();
  assert.equal(h.store.getState().pendingOrder.id, 'recovered');
});

test('logout/account switch drops pending responses and synchronously detaches private listener', async () => {
  const h = orderHarness();
  const response = deferred();
  h.api.getAvailableOrders = () => response.promise;
  const cleanup = h.store.getState().initializeRealtime();
  h.store.setState({ activeOrder: { id: 'private-old' }, activeOrders: [{ id: 'private-old' }],
    orderHistory: [{ id: 'private-history' }], routePlan: { stops: ['private-address'] },
    driverLocation: { latitude: 12, longitude: 34 } });
  h.auth.setState({ isAuthenticated: false, partner: null, token: null });
  assert.equal(h.stopped, 1);
  assert.equal(h.store.getState().activeOrder, null);
  assert.equal(h.store.getState().activeOrders.length, 0);
  assert.equal(h.store.getState().orderHistory.length, 0);
  assert.equal(h.store.getState().routePlan, null);
  assert.equal(h.store.getState().driverLocation.latitude, 0);
  h.auth.setState({ isAuthenticated: true, partner: { id: 'rider-b' }, token: 'jwt-b' });
  response.resolve({ success: true, data: [raw('old-account')] });
  await tick();
  assert.equal(h.store.getState().pendingOrder, null);
  cleanup();
  assert.equal(h.stopped, 1);
  h.api.getAvailableOrders = async () => ({ success: true, data: [raw('new-account')] });
  const nextCleanup = h.store.getState().initializeRealtime();
  await tick();
  assert.equal(h.store.getState().pendingOrder.id, 'new-account');
  nextCleanup();
});

test('real partner change clears all cached state and late history/assigned/route/mutation responses cannot repopulate it', async () => {
  for (const operation of ['fetchOrderHistory', 'fetchAssignedOrders', 'fetchRoutePlan', 'acceptOrder']) {
    const h = orderHarness();
    const cleanup = h.store.getState().initializeRealtime();
    await tick();
    const result = deferred();
    const apiMethod = { fetchOrderHistory: 'getOrderHistory', fetchAssignedOrders: 'getAssignedOrders',
      fetchRoutePlan: 'getDeliveryRoutePlan', acceptOrder: 'acceptOrder' }[operation];
    h.api[apiMethod] = () => result.promise;
    h.store.setState({ activeOrder: { id: 'old' }, activeOrders: [{ id: 'old' }],
      orderHistory: [{ id: 'old-history' }], routePlan: { stops: ['secret'] } });
    const pending = h.store.getState()[operation]('old');
    h.auth.setState({ partner: { id: 'rider-b' }, token: 'jwt-b' });
    assert.equal(h.store.getState().activeOrders.length, 0, operation);
    assert.equal(h.store.getState().orderHistory.length, 0, operation);
    assert.equal(h.store.getState().routePlan, null, operation);
    result.resolve({ success: true, data: operation === 'fetchRoutePlan'
      ? { stops: ['late-secret'] } : operation === 'acceptOrder' ? raw('late') : [raw('late')] });
    await pending;
    assert.equal(h.store.getState().activeOrders.length, 0, operation);
    assert.equal(h.store.getState().orderHistory.length, 0, operation);
    assert.equal(h.store.getState().routePlan, null, operation);
    cleanup();
  }
});

test('same-partner token rotation preserves active history and route ownership', async () => {
  const h = orderHarness();
  const cleanup = h.store.getState().initializeRealtime();
  await tick();
  h.store.setState({ activeOrder: { id: 'mine' }, activeOrders: [{ id: 'mine' }],
    orderHistory: [{ id: 'my-history' }], routePlan: { stops: ['mine'] } });
  h.auth.setState({ token: 'rotated' });
  const nextCleanup = h.store.getState().initializeRealtime();
  assert.equal(h.store.getState().activeOrder.id, 'mine');
  assert.equal(h.store.getState().orderHistory[0].id, 'my-history');
  assert.equal(h.store.getState().routePlan.stops[0], 'mine');
  cleanup();
  nextCleanup();
});

test('hydration never replays an unverified persisted ring or enables persisted accept buttons', () => {
  const h = orderHarness();
  const order = { id: 'cached', createdAt: new Date() };
  h.store.setState({ pendingOrder: order, pendingOrderReceivedAt: Date.now(),
    missedOrders: [{ order, missedAt: new Date(), expiresAt: new Date(Date.now() + 60000), reason: 'timeout', stillAvailable: true }] });
  h.store.getState().restorePersistedState();
  assert.equal(h.store.getState().pendingOrder, null);
  assert.equal(h.store.getState().incomingOrder, null);
  assert.equal(h.store.getState().missedOrders[0].stillAvailable, false);
});

function realtimeHarness(overrides = {}) {
  const scope = stateStore({ isAuthenticated: true, partner: { id: 'rider-a' } });
  const listeners = new Map();
  const authListeners = new Set();
  const foreground = new Set();
  const calls = [];
  const user = { uid: 'rider-a', getIdTokenResult: async () => ({ claims: { role: 'deliveryPartner', partnerId: 'rider-a' } }) };
  const api = { getFirebaseToken: async () => ({ success: true, data: { customToken: 'server-token', partnerId: 'rider-a' } }) };
  const firebaseAuth = {
    signInWithCustomToken: async (_auth, token) => { calls.push(['signIn', token]); return { user }; },
    signOut: async () => { calls.push(['signOut']); },
    onAuthStateChanged: (_auth, fn) => { authListeners.add(fn); fn(null); return () => authListeners.delete(fn); },
    ...overrides,
  };
  const onValue = (key, callback, error) => {
    calls.push(['listen', key]); listeners.set(key, { callback, error });
    return () => { calls.push(['off', key]); listeners.delete(key); };
  };
  const service = load('services/realtime.service.ts', {
    '@/config/firebase': { auth: {}, firebaseConfig: {} },
    'firebase/app': { getApp: () => ({}) },
    'firebase/auth': firebaseAuth,
    'firebase/database': { getDatabase: () => ({}), ref: (_db, key) => key, onValue, onChildAdded: onValue },
    './api': { ApiService: api },
    '../store/auth': { useAuthStore: scope },
    'react-native': { AppState: { addEventListener: (_event, callback) => {
      foreground.add(callback); return { remove: () => foreground.delete(callback) };
    } } },
  });
  let invalidations = 0;
  const callbacks = {
    onOffersChanged: () => { invalidations++; }, onOrderTaken() {}, onOrderUpdated() {},
    watchAssignedOrders: (listen) => { listen(['assigned']); return () => {}; },
  };
  return { service, api, user, calls, listeners, authListeners, foreground, scope, callbacks, get invalidations() { return invalidations; } };
}

test('Firebase auth and exact claims precede private listener; private replay/change/removal only invalidate REST', async () => {
  const h = realtimeHarness();
  const cleanup = h.service.subscribeToDeliveryRealtime('rider-a', h.callbacks);
  assert.equal(h.listeners.size, 0);
  await tick();
  assert.equal(h.calls[0][0], 'signIn');
  assert.ok(h.listeners.has('delivery/partners/rider-a/availableOrders'));
  assert.ok(h.listeners.has('orders/assigned'));
  assert.ok(!h.listeners.has('orders'));
  assert.ok(!h.listeners.has('delivery/availableOrders'));
  for (let i = 0; i < 3; i++) h.listeners.get('delivery/partners/rider-a/availableOrders').callback({ val: () => ({ payload: raw() }) });
  assert.equal(h.invalidations, 3);
  cleanup();
  assert.equal(h.listeners.size, 0);
  await tick();
  assert.equal(h.calls.at(-1)[0], 'signOut');
});

test('identity mismatch and token-query false both fail closed', async () => {
  for (const mismatch of ['uid', 'role', 'partnerId', 'responseId', 'queryFalse']) {
    const h = realtimeHarness();
    if (mismatch === 'uid') h.user.uid = 'other';
    if (mismatch === 'role') h.user.getIdTokenResult = async () => ({ claims: { role: 'customer', partnerId: 'rider-a' } });
    if (mismatch === 'partnerId') h.user.getIdTokenResult = async () => ({ claims: { role: 'deliveryPartner', partnerId: 'other' } });
    if (mismatch === 'responseId') h.api.getFirebaseToken = async () => ({ success: true, data: { customToken: 'x', partnerId: 'other' } });
    if (mismatch === 'queryFalse') h.api.getFirebaseToken = async () => ({ success: false });
    const cleanup = h.service.subscribeToDeliveryRealtime('rider-a', h.callbacks);
    await tick();
    assert.equal(h.listeners.size, 0, mismatch);
    assert.equal(h.invalidations, 1, mismatch);
    cleanup();
    await tick();
  }
});

test('logout before token response never signs in or attaches listeners', async () => {
  const h = realtimeHarness();
  const token = deferred();
  h.api.getFirebaseToken = () => token.promise;
  const cleanup = h.service.subscribeToDeliveryRealtime('rider-a', h.callbacks);
  await tick();
  cleanup();
  token.resolve({ success: true, data: { customToken: 'late', partnerId: 'rider-a' } });
  await tick();
  assert.ok(!h.calls.some(([operation]) => operation === 'signIn'));
  assert.equal(h.listeners.size, 0);
});

test('failed Firebase token query recovers on foreground without duplicating ready listeners', async () => {
  const h = realtimeHarness();
  const original = h.api.getFirebaseToken;
  h.api.getFirebaseToken = async () => ({ success: false });
  const cleanup = h.service.subscribeToDeliveryRealtime('rider-a', h.callbacks);
  await tick();
  assert.equal(h.listeners.size, 0);
  h.api.getFirebaseToken = original;
  for (const notify of h.foreground) notify('active');
  await tick();
  assert.ok(h.listeners.has('delivery/partners/rider-a/availableOrders'));
  const count = h.calls.length;
  for (const notify of h.foreground) notify('active');
  await tick();
  assert.equal(h.calls.length, count);
  cleanup();
  assert.equal(h.foreground.size, 0);
});

test('QR payment waits for auth, retains exact event path and detaches on sign-out', () => {
  const h = realtimeHarness();
  let paid = 0;
  const cleanup = h.service.subscribeToOrderPayment('order-qr', () => { paid++; });
  assert.equal(h.listeners.size, 0);
  for (const notify of h.authListeners) notify(h.user);
  const payment = h.listeners.get('events/orders/order-qr/payment-confirmed');
  payment.callback({ exists: () => false });
  assert.equal(paid, 0);
  payment.callback({ exists: () => true });
  assert.equal(paid, 1);
  for (const notify of h.authListeners) notify(null);
  assert.equal(h.listeners.size, 0);
  cleanup();
  assert.equal(h.authListeners.size, 0);
});

test('old QR listener cannot confirm for or reattach under a newly signed-in account', () => {
  const h = realtimeHarness();
  let paid = 0;
  const cleanup = h.service.subscribeToOrderPayment('private-order', () => { paid++; });
  for (const notify of h.authListeners) notify(h.user);
  const queued = h.listeners.get('events/orders/private-order/payment-confirmed').callback;
  h.scope.setState({ partner: { id: 'rider-b' } });
  assert.equal(h.listeners.size, 0);
  assert.equal(h.authListeners.size, 0);
  queued({ exists: () => true });
  assert.equal(paid, 0);
  cleanup();
});
