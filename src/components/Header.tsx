import { ConnectButton, useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';
import { ADMIN_ADDRESS } from '../configs/constants';

function Header() {
    const account = useCurrentAccount();
    const suiClient = useSuiClient();
    const isAdmin = !!account && ADMIN_ADDRESS && account.address.toLowerCase() === ADMIN_ADDRESS.toLowerCase();
    const { data: balance } = useQuery({
        queryKey: ['sui-balance', account?.address],
        enabled: !!account,
        queryFn: async () => {
            const resp = await suiClient.getBalance({ owner: account!.address });
            return Number(resp.totalBalance) / 1_000_000_000;
        },
        refetchInterval: 15000,
    });
    return (
        <header className="app-header">
            <div className="container header-inner">
                <div className="brand">
                    <span className="brand-badge">NFT</span>
                    <span className="brand-text">Marketplace</span>
                    <span className="brand-env" title="Running on Sui Testnet">Testnet</span>
                    {isAdmin && <span className="brand-admin" title="Admin session">Admin</span>}
                </div>
                <nav className="nav-actions">
                    <a className="nav-link" href="#home">Home</a>
                    <a className="nav-link" href="#mint">Mint</a>
                    <a className="nav-link" href="#/activity">Activity</a>
             
                    {account && (
                        <span className="nav-link" title={account.address}>
                            {balance?.toFixed(3)} SUI
                        </span>
                    )}
                    <ConnectButton />
                </nav>
            </div>
        </header>
    );
}

export default Header;


