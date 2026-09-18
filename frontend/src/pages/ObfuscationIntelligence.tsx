import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ObfuscationPanel } from '../components/ObfuscationPanel';

export const ObfuscationIntelligence: React.FC = () => {
  const [params] = useSearchParams();
  const txid = params.get('txid') || '';
  return <ObfuscationPanel mode="full" defaultTxid={txid} />;
};
