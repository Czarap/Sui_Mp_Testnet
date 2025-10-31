import { suiClient } from '../lib/sui-client';
import { CONTRACT_CONFIG, DEMO_MODE } from '../config/sui';
import { useQuery } from '@tanstack/react-query';
import { MOCK_LISTINGS } from '../lib/mock-data';
import { useState } from 'react';

export interface Listing {
  id: string;
  nftId: string;
  seller: string;
  price: string;
  name?: string;
  description?: string;
  imageUrl?: string;
}

export function useListings() {
  const [mockListings, setMockListings] = useState<Listing[]>(MOCK_LISTINGS);

  if (DEMO_MODE) {
    return {
      listings: mockListings,
      isLoading: false,
      error: null,
      refetch: async () => setMockListings([...MOCK_LISTINGS]),
    } as const;
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['listings'],
    queryFn: async () => {
      try {
        if (
          !CONTRACT_CONFIG.MARKETPLACE_ID ||
          CONTRACT_CONFIG.MARKETPLACE_ID === '0x_MARKETPLACE_ID_HERE' ||
          CONTRACT_CONFIG.MARKETPLACE_ID ===
            '0x0000000000000000000000000000000000000000000000000000000000000000'
        ) {
          return [] as Listing[];
        }

        if (
          !CONTRACT_CONFIG.PACKAGE_ID ||
          CONTRACT_CONFIG.PACKAGE_ID === '0x_YOUR_PACKAGE_ID_HERE' ||
          CONTRACT_CONFIG.PACKAGE_ID ===
            '0x0000000000000000000000000000000000000000000000000000000000000000'
        ) {
          return [] as Listing[];
        }

        const listingsResponse = await suiClient.queryEvents({
          query: {
            MoveEventType: `${CONTRACT_CONFIG.PACKAGE_ID}::marketplace::NFTListed`,
          },
          limit: 50,
        });

        const listings: Listing[] = [];

        for (const event of listingsResponse.data) {
          const parsedJson = event.parsedJson as any;
          if (parsedJson) {
            try {
              const nftObj = await suiClient.getObject({
                id: parsedJson.nft_id,
                options: {
                  showContent: true,
                  showDisplay: true,
                },
              });

              const display = nftObj.data?.display?.data;
              const content = nftObj.data?.content;
              let nftData: any = {};

              if (content && 'fields' in content) {
                nftData = content.fields;
              }

              listings.push({
                id: parsedJson.listing_id || event.id.txDigest,
                nftId: parsedJson.nft_id,
                seller: parsedJson.seller,
                price: parsedJson.price,
                name: display?.name || nftData?.name || 'Unnamed NFT',
                description: display?.description || nftData?.description || '',
                imageUrl: display?.image_url || nftData?.image_url || '',
              });
            } catch (err) {
              console.error('Error fetching NFT details:', err);
            }
          }
        }

        return listings;
      } catch (err) {
        console.error('Error fetching listings:', err);
        return [] as Listing[];
      }
    },
    refetchInterval: 10000,
  });

  return {
    listings: data || [],
    isLoading,
    error,
    refetch,
  } as const;
}


