import { createNetworkConfig, SuiClientProvider, WalletProvider, ConnectButton } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Minter from './components/Mint';
import './App.css';
import { StrictMode } from 'react';

// Config options for the networks you want to connect to
const { networkConfig } = createNetworkConfig({
  localnet: { url: getFullnodeUrl('localnet') },
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
});

const queryClient = new QueryClient();

function App() {
  return (
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <SuiClientProvider networks={networkConfig} defaultNetwork='testnet'>
                <WalletProvider>
                  <header className='app-header'>
                    <ConnectButton />
                  </header>
                  <main className='app-main'>
                    <Minter />
                  </main>
                </WalletProvider>
            </SuiClientProvider>
        </QueryClientProvider>
      </StrictMode>
  );
}

export default App
