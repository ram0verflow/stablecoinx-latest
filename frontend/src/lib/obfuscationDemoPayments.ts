/**
 * Obfuscation Intelligence demo payments — seeded once via the real
 * payment-creation API (see docs/OBFUSCATION_INTELLIGENCE_DEMO.md), each
 * tagged with a real, Blockstream-verified Bitcoin txid and real BTC
 * wallet addresses (recorded in the payment's own `purpose` field so
 * they're visible/markable in the product itself, not just here).
 *
 * These are the ONLY payments the product cross-references against a
 * Bitcoin txid — every other payment is a normal EVM (Base/Polygon)
 * stablecoin transfer with no Bitcoin association, so Obfuscation
 * Intelligence stays hidden for them rather than showing a repeated,
 * out-of-context result.
 */

export interface ObfuscationDemoPayment {
  paymentId: string;
  txid: string;
  label: string;
}

export const OBFUSCATION_DEMO_PAYMENTS: ObfuscationDemoPayment[] = [
  {
    paymentId: 'f474b0a2-3287-4350-bb20-8eb100e5beea',
    txid: '5553386e94b07112fb7b6789cae2f89f380ca20a28935812c51f0f3387bd5243',
    label: 'Whirlpool CoinJoin',
  },
  {
    paymentId: 'b3332fe2-9608-482c-a623-869a1c466b89',
    txid: 'dfe57d33a81720a059ceb5e84d546a05e55791b0eafca50574c9ed4c645ee575',
    label: 'External Attribution Flag',
  },
  {
    paymentId: '201afd7e-2da7-477b-bfb1-44edec7e895f',
    txid: '2759143d93dc0bc29170eae07ad97a9c8931b60a7b673de04ac26d9764324a38',
    label: 'Provider Outage',
  },
  {
    paymentId: '486f42be-a9ef-4e3e-9060-f9ce13a6f785',
    txid: '4e624682a5b69dbd1596628eec644c0f4782ba798f2794f7177715395bca7b91',
    label: 'Clean Baseline',
  },
];

const BY_ID: Record<string, ObfuscationDemoPayment> = Object.fromEntries(
  OBFUSCATION_DEMO_PAYMENTS.map((d) => [d.paymentId, d]),
);

export const getObfuscationDemoForPayment = (paymentId: string): ObfuscationDemoPayment | undefined =>
  BY_ID[paymentId];
