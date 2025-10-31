import { useState } from 'react';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getFunctionId, CONTRACT_CONFIG, DEMO_MODE } from '../config/sui';
import { suiToMist } from '../lib/sui-client';

interface ListNFTDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nftId: string;
  nftName: string;
  onSuccess?: () => void;
}

export function ListNFTDialog({ open, onOpenChange, nftId, nftName, onSuccess }: ListNFTDialogProps) {
  const [price, setPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('Please enter a valid price greater than 0');
      return;
    }

    setIsSubmitting(true);

    if (DEMO_MODE) {
      setTimeout(() => {
        toast.success(`🎨 Demo: "${nftName}" listed for ${priceNum} SUI!`);
        setPrice('');
        onOpenChange(false);
        setIsSubmitting(false);
        onSuccess?.();
      }, 1500);
      return;
    }

    try {
      const tx = new Transaction();
      const priceInMist = suiToMist(priceNum);
      tx.moveCall({
        target: getFunctionId('LIST'),
        arguments: [tx.object(CONTRACT_CONFIG.MARKETPLACE_ID), tx.object(nftId), tx.pure.u64(priceInMist)],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: () => {
            toast.success(`"${nftName}" listed for ${price} SUI`);
            setPrice('');
            onOpenChange(false);
            onSuccess?.();
          },
          onError: (error) => {
            toast.error(`Listing failed: ${error.message}`);
          },
        },
      );
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>List NFT for Sale</DialogTitle>
            <DialogDescription>Set a price for "{nftName}" and list it on the marketplace.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price (SUI) *</Label>
              <Input id="price" type="number" step="0.001" min="0.001" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} disabled={isSubmitting} required />
              <p className="text-xs text-muted-foreground">Minimum price: 0.001 SUI</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Listing...' : 'List NFT'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


