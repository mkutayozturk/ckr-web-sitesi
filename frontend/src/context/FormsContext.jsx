import React, { createContext, useContext, useState, useCallback } from 'react';

const FormsContext = createContext(null);

export function FormsProvider({ children }) {
  const [activeForm, setActiveForm] = useState('alici');

  const openForm = useCallback((key) => {
    if (key) setActiveForm(key);
    const el = document.getElementById('analiz');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <FormsContext.Provider value={{ activeForm, setActiveForm, openForm }}>
      {children}
    </FormsContext.Provider>
  );
}

export function useForms() {
  const ctx = useContext(FormsContext);
  if (!ctx) throw new Error('useForms must be used within FormsProvider');
  return ctx;
}
