import type { NFTData } from '../hooks/useSuiNFTs';
import type { Listing } from '../hooks/useListings';

export const MOCK_NFTS: NFTData[] = [
  {
    id: 'mock-nft-1',
    objectId: 'mock-nft-1',
    name: 'Cosmic Voyager #001',
    description: 'A stunning digital artwork depicting a journey through the cosmos',
    imageUrl:
      'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&h=800&fit=crop',
    owner: '0x1234567890abcdef1234567890abcdef12345678',
  },
  {
    id: 'mock-nft-2',
    objectId: 'mock-nft-2',
    name: 'Ocean Dreams #042',
    description: 'Serene underwater scene with vibrant marine life',
    imageUrl:
      'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&h=800&fit=crop',
    owner: '0x1234567890abcdef1234567890abcdef12345678',
  },
  {
    id: 'mock-nft-3',
    objectId: 'mock-nft-3',
    name: 'Neon City #789',
    description: 'Futuristic cyberpunk cityscape with neon lights',
    imageUrl:
      'https://images.unsplash.com/photo-1518005020951-eccb494ad742?w=800&h=800&fit=crop',
    owner: '0x1234567890abcdef1234567890abcdef12345678',
  },
];

export const MOCK_LISTINGS: Listing[] = [];

export const MOCK_MARKETPLACE_STATS = {
  totalListings: MOCK_LISTINGS.length,
  totalVolume: '50500000000',
  feePercentage: 2.5,
  accumulatedFees: '1262500000',
};


