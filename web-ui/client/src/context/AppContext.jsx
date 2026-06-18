import React, {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useCallback,
} from 'react';
import { getCustomers, getCustomer, getOverdueFollowUps } from '../api.js';

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------
const initialState = {
  user: null,
  customers: [],
  activeCustomer: null,
  notifications: [],
  toasts: [],
  sseConnected: false,
};

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------
const SET_USER = 'SET_USER';
const SET_CUSTOMERS = 'SET_CUSTOMERS';
const SET_ACTIVE_CUSTOMER = 'SET_ACTIVE_CUSTOMER';
const SET_NOTIFICATIONS = 'SET_NOTIFICATIONS';
const ADD_TOAST = 'ADD_TOAST';
const REMOVE_TOAST = 'REMOVE_TOAST';
const SET_SSE_CONNECTED = 'SET_SSE_CONNECTED';

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------
function appReducer(state, action) {
  switch (action.type) {
    case SET_USER:
      return { ...state, user: action.payload };

    case SET_CUSTOMERS:
      return { ...state, customers: action.payload };

    case SET_ACTIVE_CUSTOMER:
      return { ...state, activeCustomer: action.payload };

    case SET_NOTIFICATIONS:
      return { ...state, notifications: action.payload };

    case ADD_TOAST:
      return { ...state, toasts: [...state.toasts, action.payload] };

    case REMOVE_TOAST:
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.payload),
      };

    case SET_SSE_CONNECTED:
      return { ...state, sseConnected: action.payload };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
export const AppContext = createContext(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // -- setUser ---------------------------------------------------------------
  const setUser = useCallback((u) => {
    dispatch({ type: SET_USER, payload: u });
  }, []);

  // -- loadCustomers ---------------------------------------------------------
  const loadCustomers = useCallback(async () => {
    try {
      const data = await getCustomers();
      dispatch({ type: SET_CUSTOMERS, payload: Array.isArray(data) ? data : [] });
    } catch (err) {
      console.error('loadCustomers error:', err);
    }
  }, []);

  // -- openCustomer ----------------------------------------------------------
  const openCustomer = useCallback(async (email) => {
    try {
      const data = await getCustomer(email);
      dispatch({ type: SET_ACTIVE_CUSTOMER, payload: data });
    } catch (err) {
      console.error('openCustomer error:', err);
    }
  }, []);

  // -- refreshActiveCustomer -------------------------------------------------
  const refreshActiveCustomer = useCallback(async () => {
    // Use a functional read of the current state via a ref-like pattern.
    // Because useReducer's dispatch is stable we capture state directly in
    // the closure; we re-declare via the reducer's latest value by passing
    // a thunk-style approach using the dispatch itself is not natively
    // supported, so we rely on the stable `state` closure captured here.
    // This is safe because refreshActiveCustomer is re-created whenever
    // `state.activeCustomer` changes (see deps below).
    if (!state.activeCustomer) return;
    try {
      const data = await getCustomer(state.activeCustomer.email);
      dispatch({ type: SET_ACTIVE_CUSTOMER, payload: data });
    } catch (err) {
      console.error('refreshActiveCustomer error:', err);
    }
  }, [state.activeCustomer]);

  // -- loadNotifications -----------------------------------------------------
  const loadNotifications = useCallback(async () => {
    try {
      const data = await getOverdueFollowUps();
      dispatch({ type: SET_NOTIFICATIONS, payload: Array.isArray(data) ? data : [] });
    } catch (err) {
      console.error('loadNotifications error:', err);
    }
  }, []);

  // -- addToast --------------------------------------------------------------
  const addToast = useCallback((type, message) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    dispatch({ type: ADD_TOAST, payload: { id, type, message } });
    setTimeout(() => {
      dispatch({ type: REMOVE_TOAST, payload: id });
    }, 4000);
  }, []);

  // -- removeToast -----------------------------------------------------------
  const removeToast = useCallback((id) => {
    dispatch({ type: REMOVE_TOAST, payload: id });
  }, []);

  // -- setSseConnected -------------------------------------------------------
  const setSseConnected = useCallback((b) => {
    dispatch({ type: SET_SSE_CONNECTED, payload: b });
  }, []);

  // ---------------------------------------------------------------------------
  // Context value — memoised to prevent unnecessary re-renders
  // ---------------------------------------------------------------------------
  const value = useMemo(
    () => ({
      // state
      ...state,
      // actions
      setUser,
      loadCustomers,
      openCustomer,
      refreshActiveCustomer,
      loadNotifications,
      addToast,
      removeToast,
      setSseConnected,
    }),
    [
      state,
      setUser,
      loadCustomers,
      openCustomer,
      refreshActiveCustomer,
      loadNotifications,
      addToast,
      removeToast,
      setSseConnected,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ---------------------------------------------------------------------------
// Convenience hook
// ---------------------------------------------------------------------------
export function useApp() {
  const ctx = useContext(AppContext);
  if (ctx === null) {
    throw new Error('useApp must be used inside an <AppProvider>');
  }
  return ctx;
}
