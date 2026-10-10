import React, { createContext, useContext, useState, useCallback } from 'react';

const FormsContext = createContext(null);

export function FormsProvider({ children }) {
  const [activeForm, setActiveForm] = useState('alici');
  const [formSource, setFormSource] = useState({ button_source: 'direct', form_type: 'alici' });

  const openForm = useCallback((key, source = 'direct') => {
    if (key) setActiveForm(key);
    setFormSource({ button_source: source, form_type: key || activeForm });
    const el = document.getElementById('analiz');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [activeForm]);

  return (
    <FormsContext.Provider value={{ activeForm, setActiveForm, openForm, formSource, setFormSource }}>
      {children}
    </FormsContext.Provider>
  );
}

export function useForms() {
  const ctx = useContext(FormsContext);
  if (!ctx) throw new Error('useForms must be used within FormsProvider');
  return ctx;
}
