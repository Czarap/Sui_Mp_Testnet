import { createNetworkConfig, SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Minter from './components/Mint';
import Header from './components/Header';
import Footer from './components/Footer';
import { NftProvider } from './context/NftContext';
import AdminPanel from './components/AdminPanel';
import Marketplace from './components/Marketplace';
import Home from './components/Home';
import Activity from './components/Activity';
import { useEffect, useState } from 'react';
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
  const [route, setRoute] = useState<string>(() => (window.location.hash || '#/').replace('#', ''));
  useEffect(() => {
    const onHash = () => setRoute((window.location.hash || '#/').replace('#', ''));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const isActivity = route.startsWith('/activity');
  const isHome = !isActivity;

  return (
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <SuiClientProvider networks={networkConfig} defaultNetwork='testnet'>
                <WalletProvider>
                  <NftProvider>
                  <Header />
                  <section className="hero">
                    <div className="container hero-inner">
                      <div className="hero-copy">
                        <h1>Create, collect and showcase digital art</h1>
                        <p className="muted">Mint NFTs on Sui in seconds. Connect your wallet, fill in details, and publish to the world.</p>
                        <a href="#mint" className="button primary">Start Minting</a>
                      </div>
                      <div className="hero-art" aria-hidden>
                        <div className="blob b1"></div>
                        <div className="blob b2"></div>
                        <div className="blob b3"></div>
                      </div>
                    </div>
                  </section>
                  {isHome && <Home />}
                  {isActivity && (
                    <main className='app-main container'>
                      <section className="section">
                        <div className="section-head">
                          <h2>Marketplace Activity</h2>
                        </div>
                        <Activity />
                      </section>
                    </main>
                  )}
                  <main className='app-main container'>
                    {isHome && (
                    <section id="mint" className="section">
                      <div className="section-head">
                        <h2>Mint an NFT</h2>
                        <p className="muted">Provide a name, description and image URL. Preview updates live.</p>
                      </div>
                      <div className="mint-layout">
                        <div className="mint-panel">
                          <Minter />
                        </div>
                      </div>
                    </section>
                    )}
                    {isHome && <Marketplace />}
                    {isHome && <AdminPanel />}
                  </main>
                  <Footer />
                  </NftProvider>
                </WalletProvider>
            </SuiClientProvider>
        </QueryClientProvider>
      </StrictMode>
  );
}

export default App
