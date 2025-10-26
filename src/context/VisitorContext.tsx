import { createContext, useContext, ReactNode } from 'react';
import { VisitorData } from '../types';

interface VisitorContextType {
  visitorData: VisitorData | null;
}

const VisitorContext = createContext<VisitorContextType | null>(null);

interface VisitorProviderProps {
  children: ReactNode;
  visitorData: VisitorData | null;
}

export function VisitorProvider({ children, visitorData }: VisitorProviderProps) {
  return (
    <VisitorContext.Provider value={{ visitorData }}>
      {children}
    </VisitorContext.Provider>
  );
}

export function useVisitorContext() {
  const context = useContext(VisitorContext);
  if (!context) {
    throw new Error('useVisitorContext must be used within a VisitorProvider');
  }
  return context;
}
