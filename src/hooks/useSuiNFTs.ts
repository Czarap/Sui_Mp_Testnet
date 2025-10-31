import { useCurrentAccount, useSuiClientQuery } from '@mysten/dapp-kit';
import { getType, CONTRACT_CONFIG, DEMO_MODE } from '../config/sui';
import { MOCK_NFTS } from '../lib/mock-data';
import { useState } from 'react';

export interface NFTData {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  owner: string;
  objectId: string;
}

export function useSuiNFTs() {
  const account = useCurrentAccount();
  const [mockNfts, setMockNfts] = useState<NFTData[]>(MOCK_NFTS);

  const isConfigured =
    CONTRACT_CONFIG.PACKAGE_ID &&
    CONTRACT_CONFIG.PACKAGE_ID !== '0x_YOUR_PACKAGE_ID_HERE' &&
    CONTRACT_CONFIG.PACKAGE_ID !==
      '0x0000000000000000000000000000000000000000000000000000000000000000';

  if (DEMO_MODE) {
    return {
      nfts: account ? mockNfts : [],
      isLoading: false,
      error: null,
      refetch: async () => {
        setMockNfts([...MOCK_NFTS]);
      },
    } as const;
  }

  const { data: ownedObjects, isLoading, error, refetch } = useSuiClientQuery(
    'getOwnedObjects',
    {
      owner: account?.address || '',
      filter: {
        StructType: getType('NFT'),
      },
      options: {
        showContent: true,
        showDisplay: true,
        showType: true,
      },
    },
    {
      enabled: !!account && isConfigured,
    },
  );

  const nfts: NFTData[] =
    ownedObjects?.data?.map((obj) => {
      const content = obj.data?.content;
      const display = obj.data?.display?.data;

      if (content && 'fields' in content) {
        const fields = content.fields as any;
        return {
          id: obj.data?.objectId || '',
          objectId: obj.data?.objectId || '',
          name: display?.name || fields?.name || 'Unnamed NFT',
          description: display?.description || fields?.description || '',
          imageUrl: display?.image_url || fields?.image_url || '',
          owner: account?.address || '',
        };
      }

      return null;
    }).filter((nft): nft is NFTData => nft !== null) || [];

  return {
    nfts,
    isLoading,
    error,
    refetch,
  } as const;
}


