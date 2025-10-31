import { useState } from 'react';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getFunctionId, DEMO_MODE } from '../config/sui';

export function MintNFTDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', imageUrl: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('NFT name is required');
      return;
    }
    if (!formData.imageUrl.trim()) {
      toast.error('Image URL is required');
      return;
    }
    setIsSubmitting(true);

    if (DEMO_MODE) {
      setTimeout(() => {
        toast.success(`🎨 Demo: NFT "${formData.name}" minted successfully!`);
        setFormData({ name: '', description: '', imageUrl: '' });
        setOpen(false);
        setIsSubmitting(false);
        onSuccess?.();
      }, 1500);
      return;
    }

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: getFunctionId('MINT'),
        arguments: [tx.pure.string(formData.name), tx.pure.string(formData.description), tx.pure.string(formData.imageUrl)],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: () => {
            toast.success(`NFT "${formData.name}" minted successfully!`);
            setFormData({ name: '', description: '', imageUrl: '' });
            setOpen(false);
            onSuccess?.();
          },
          onError: (error) => {
            toast.error(`Mint failed: ${error.message}`);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Mint NFT
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Mint New NFT</DialogTitle>
            <DialogDescription>Create a new NFT on the Sui blockchain. Fill in the details below.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" placeholder="My Awesome NFT" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} disabled={isSubmitting} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" placeholder="Describe your NFT..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} disabled={isSubmitting} rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imageUrl">Image URL *</Label>
              <Input id="imageUrl" type="url" placeholder="https://example.com/image.png" value={formData.imageUrl} onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })} disabled={isSubmitting} required />
              <p className="text-xs text-muted-foreground">Use IPFS or any publicly accessible image URL</p>
            </div>
            {formData.imageUrl && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="rounded-lg border overflow-hidden aspect-square max-w-[200px]">
                  <img
                    src={formData.imageUrl}
                    alt="NFT Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400?text=Invalid+URL';
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Minting...' : 'Mint NFT'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


