import { useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useSuiNFTs } from '../hooks/useSuiNFTs';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Alert, AlertDescription } from './ui/alert';
import { Wallet, Tag, RefreshCw } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { ListNFTDialog } from './ListNFTDialog';

export function MyNFTsTab() {
  const account = useCurrentAccount();
  const { nfts, isLoading, refetch } = useSuiNFTs();
  const [selectedNFT, setSelectedNFT] = useState<{ id: string; name: string } | null>(null);

  if (!account) {
    return (
      <Alert>
        <Wallet className="h-4 w-4" />
        <AlertDescription>Please connect your wallet to view your NFTs</AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <Skeleton className="aspect-square w-full" />
            <div className="p-4 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (nfts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground mb-4">You don't own any NFTs yet</div>
        <p className="text-sm text-muted-foreground mb-4">Mint your first NFT or buy one from the marketplace</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl mb-1">My NFTs</h2>
          <p className="text-sm text-muted-foreground">
            {nfts.length} NFT{nfts.length !== 1 ? 's' : ''} owned
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {nfts.map((nft) => (
          <Card key={nft.id} className="overflow-hidden group hover:shadow-lg transition-shadow">
            <div className="relative aspect-square overflow-hidden bg-muted">
              <ImageWithFallback src={nft.imageUrl} alt={nft.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
            </div>

            <div className="p-4 space-y-3">
              <div>
                <h3 className="line-clamp-1">{nft.name}</h3>
                {nft.description && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{nft.description}</p>}
              </div>

              <Button className="w-full gap-2" onClick={() => setSelectedNFT({ id: nft.objectId, name: nft.name })}>
                <Tag className="h-4 w-4" />
                List for Sale
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {selectedNFT && (
        <ListNFTDialog
          open={!!selectedNFT}
          onOpenChange={(open) => !open && setSelectedNFT(null)}
          nftId={selectedNFT.id}
          nftName={selectedNFT.name}
          onSuccess={() => {
            refetch();
            setSelectedNFT(null);
          }}
        />
      )}
    </>
  );
}


