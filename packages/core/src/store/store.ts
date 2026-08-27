import {
  FLUSH,
  PAUSE,
  PURGE,
  PERSIST,
  REGISTER,
  REHYDRATE,
  persistStore,
  persistReducer,
} from 'redux-persist';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import storage from 'redux-persist/lib/storage'; // defaults to localStorage
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

// Reducers
import uiReducer from './slices/ui';
import authReducer from './slices/auth';
import languageReducer from './slices/language';
import artistsReducer from './slices/artists';
import subscriptionReducer from './slices/subscription';
import artistPurchasesReducer from './slices/artistPurchases';
import nytaChatReducer from './slices/nytaChat';

const appReducer = combineReducers({
  ui: uiReducer,
  auth: authReducer,
  language: languageReducer,
  artists: artistsReducer,
  subscription: subscriptionReducer,
  artistPurchases: artistPurchasesReducer,
  nytaChat: nytaChatReducer,
});

// @ts-ignore
const rootReducer = (state, action) => {
  if (action.type === 'auth/clearAuth' || action.type === 'auth/signOut/fulfilled') {
    // Mantém apenas idioma/ui ao sair.
    const preserved = state ? { language: state.language, ui: state.ui } : undefined;
    return appReducer(preserved as any, action);
  }
  return appReducer(state, action);
};

const whitelist = ['language', 'ui'] as string[];

const persistedReducer = persistReducer(
  {
    storage,
    whitelist,
    key: 'root',
  },
  rootReducer
);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export const persistor = persistStore(store);
