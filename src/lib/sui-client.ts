import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { NETWORK } from '../config/sui';

const rpcUrl = getFullnodeUrl(NETWORK as any);
export const suiClient = new SuiClient({ url: rpcUrl });

export function formatSui(mist: string | number | bigint): string {
  const amount = BigInt(mist);
  const sui = Number(amount) / 1_000_000_000;
  return sui.toFixed(4);
}

export function suiToMist(sui: string | number): bigint {
  const amount = typeof sui === 'string' ? parseFloat(sui) : sui;
  return BigInt(Math.floor(amount * 1_000_000_000));
}


