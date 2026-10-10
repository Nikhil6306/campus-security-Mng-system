import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type VisitorStatus = 'inside' | 'checked out';
export type Visitor = {
  id: string;
  name: string;
  phone: string;
  purpose: string;
  host: string;
  gate: string;
  time: string;
  status: VisitorStatus;
  qrCode: string;
  photo?: string;
};
export type Emergency = { id: string; type: string; location: string; details: string; time: string };

const initialVisitors: Visitor[] = [
  { id: 'V-2048', name: 'Ananya Sharma', phone: '98765 43210', purpose: 'Parent meeting', host: 'Admissions', gate: 'Main Gate', time: '09:42 AM', status: 'inside', qrCode: 'V-2048' },
  { id: 'V-2047', name: 'Rahul Mehta', phone: '98123 45670', purpose: 'Guest lecture', host: 'Computer Science', gate: 'North Gate', time: '09:18 AM', status: 'inside', qrCode: 'V-2047' },
  { id: 'V-2046', name: 'Priya Nair', phone: '99001 23456', purpose: 'Campus tour', host: 'Student Affairs', gate: 'Main Gate', time: '08:56 AM', status: 'checked out', qrCode: 'V-2046' },
  { id: 'V-2045', name: 'Arjun Patel', phone: '98220 12012', purpose: 'Maintenance', host: 'Facilities', gate: 'Service Gate', time: '08:31 AM', status: 'checked out', qrCode: 'V-2045' },
];

type Store = {
  visitors: Visitor[];
  emergencies: Emergency[];
  addVisitor: (visitor: Omit<Visitor, 'id' | 'time' | 'status' | 'qrCode'>) => Visitor;
  checkout: (id: string) => void;
  addEmergency: (emergency: Omit<Emergency, 'id' | 'time'>) => void;
};

const StoreContext = createContext<Store | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [visitors, setVisitors] = useState(initialVisitors);
  const [emergencies, setEmergencies] = useState<Emergency[]>([
    { id: 'E-102', type: 'Medical assistance', location: 'Science block · Demo', details: 'Nurse notified for a minor incident', time: 'Yesterday, 3:12 PM' },
  ]);
  const value = useMemo<Store>(() => ({
    visitors,
    emergencies,
    addVisitor: visitor => {
      const id = `V-${2049 + visitors.length - initialVisitors.length}`;
      const record: Visitor = { ...visitor, id, qrCode: id, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: 'inside' };
      setVisitors(current => [record, ...current]);
      return record;
    },
    checkout: id => setVisitors(current => current.map(visitor => visitor.id === id ? { ...visitor, status: 'checked out' } : visitor)),
    addEmergency: emergency => setEmergencies(current => [{ ...emergency, id: `E-${103 + current.length}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...current]),
  }), [visitors, emergencies]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useDemoStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useDemoStore must be used inside DemoProvider');
  return value;
}
