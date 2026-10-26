import './styles.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Rapports d’activités', description: 'Rapports et activités publiés.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="fr"><body>{children}</body></html>; }
