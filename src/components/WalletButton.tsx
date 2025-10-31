import { useCurrentAccount, useDisconnectWallet, useConnectWallet, useSuiClientQuery } from '@mysten/dapp-kit';
import { Button } from './ui/button';
import { Wallet, LogOut, Copy, Check } from 'lucide-react';
import { formatSui } from '../lib/sui-client';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { toast } from 'sonner';

export function WalletButton() {
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const { mutate: connect } = useConnectWallet();
  const [copied, setCopied] = useState(false);

  const { data: balance } = useSuiClientQuery(
    'getBalance',
    { owner: account?.address || '' },
    { enabled: !!account },
  );

  const handleCopyAddress = () => {
    if (account?.address) {
      navigator.clipboard.writeText(account.address);
      setCopied(true);
      toast.success('Address copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

  if (!account) {
    return (
      <Button onClick={() => connect({ wallet: undefined })} className="gap-2">
        <Wallet className="h-4 w-4" />
        Connect Wallet
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Wallet className="h-4 w-4" />
          <span className="hidden md:inline">{formatAddress(account.address)}</span>
          <span className="md:hidden">Wallet</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>My Wallet</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-2 space-y-2">
          <div className="text-sm">
            <div className="text-muted-foreground mb-1">Address</div>
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs">{formatAddress(account.address)}</code>
              <button onClick={handleCopyAddress} className="p-1 hover:bg-accent rounded">
                {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>

          <div className="text-sm">
            <div className="text-muted-foreground mb-1">Balance</div>
            <div className="font-semibold">{balance ? formatSui(balance.totalBalance) : '0.0000'} SUI</div>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => disconnect()} className="text-red-600 cursor-pointer">
          <LogOut className="h-4 w-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


