import { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useListings } from '../hooks/useListings';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { ShoppingCart, X, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { formatSui } from '../lib/sui-client';
import { toast } from 'sonner';
import { getFunctionId, CONTRACT_CONFIG, DEMO_MODE } from '../config/sui';

export function MarketplaceTab() {
  const account = useCurrentAccount();
  const { listings, isLoading, refetch } = useListings();
  const [buyingNFT, setBuyingNFT] = useState<string | null>(null);
  const [cancelingListing, setCancelingListing] = useState<string | null>(null);

  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const handleBuy = async (listingId: string, price: string, nftName: string) => {
    if (!account) {
      toast.error('Please connect your wallet');
      return;
    }

    setBuyingNFT(listingId);

    if (DEMO_MODE) {
      setTimeout(() => {
        toast.success(`🎨 Demo: Successfully purchased "${nftName}"!`);
        setBuyingNFT(null);
        refetch();
      }, 1500);
      return;
    }

    try {
      const tx = new Transaction();

      const priceInMist = BigInt(price);
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(priceInMist)]);

      tx.moveCall({
        target: getFunctionId('BUY'),
        arguments: [tx.object(CONTRACT_CONFIG.MARKETPLACE_ID), tx.object(listingId), coin],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: () => {
            toast.success(`Successfully purchased "${nftName}"!`);
            refetch();
          },
          onError: (error) => {
            toast.error(`Purchase failed: ${error.message}`);
          },
        },
      );
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setBuyingNFT(null);
    }
  };

  const handleCancelListing = async (listingId: string, nftName: string) => {
    if (!account) {
      toast.error('Please connect your wallet');
      return;
    }

    setCancelingListing(listingId);

    if (DEMO_MODE) {
      setTimeout(() => {
        toast.success(`🎨 Demo: Listing for "${nftName}" canceled`);
        setCancelingListing(null);
        refetch();
      }, 1500);
      return;
    }

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: getFunctionId('CANCEL_LISTING'),
        arguments: [tx.object(CONTRACT_CONFIG.MARKETPLACE_ID), tx.object(listingId)],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: () => {
            toast.success(`Listing for "${nftName}" canceled`);
            refetch();
          },
          onError: (error) => {
            toast.error(`Cancel failed: ${error.message}`);
          },
        },
      );
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setCancelingListing(null);
    }
  };

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

  if (listings.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <div className="mx-auto mb-4 size-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500" />
        <h3 className="text-lg font-medium mb-1">No listings yet</h3>
        <p className="text-sm text-muted-foreground mb-4">Be the first to mint and list an NFT on the marketplace.</p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl mb-1">Marketplace</h2>
          <p className="text-sm text-muted-foreground">
            {listings.length} NFT{listings.length !== 1 ? 's' : ''} listed
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {listings.map((listing) => {
          const isOwner = account?.address === listing.seller;
          const isBuying = buyingNFT === listing.id;
          const isCanceling = cancelingListing === listing.id;

          return (
            <Card key={listing.id} className="overflow-hidden group hover:shadow-lg transition-shadow">
              <div className="relative aspect-square overflow-hidden bg-muted">
                <ImageWithFallback
                  src={listing.imageUrl || ''}
                  alt={listing.name || 'NFT'}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                {isOwner && (
                  <Badge className="absolute top-3 left-3" variant="secondary">
                    Your Listing
                  </Badge>
                )}
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <h3 className="line-clamp-1">{(listing.name || 'Unnamed NFT')}</h3>
                  {listing.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{listing.description}</p>
                  )}
                </div>

                <div className="pt-2 border-t">
                  <div className="text-xs text-muted-foreground">Price</div>
                  <div className="text-xl font-semibold">{formatSui(listing.price)} SUI</div>
                </div>

                {isOwner ? (
                  <Button
                    variant="destructive"
                    className="w-full gap-2"
                    onClick={() => handleCancelListing(listing.id, listing.name || 'NFT')}
                    disabled={isCanceling}
                  >
                    {isCanceling ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Canceling...
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4" />
                        Cancel Listing
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    className="w-full gap-2"
                    onClick={() => handleBuy(listing.id, listing.price, listing.name || 'NFT')}
                    disabled={!account || isBuying}
                  >
                    {isBuying ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Buying...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-4 w-4" />
                        Buy Now
                      </>
                    )}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}


