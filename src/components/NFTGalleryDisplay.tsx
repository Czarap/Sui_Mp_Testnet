import { useEffect, useState } from 'react';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

const client = new SuiClient({ url: getFullnodeUrl('testnet') });

type NFTDisplayData = {
    name?: string;
    description?: string;
    image_url?: string;
};

export default function NFTGalleryDisplay({ ownerAddress }: { ownerAddress: string }) {
    const [nfts, setNfts] = useState<NFTDisplayData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        async function fetchNFTs() {
            try {
                const objects = await client.getOwnedObjects({
                    owner: ownerAddress,
                    options: { showDisplay: true },
                });
                const displayData = objects.data
                    .map((obj) => (obj.data as any)?.display?.data as NFTDisplayData)
                    .filter((d) => d && d.image_url);
                if (mounted) setNfts(displayData);
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error('Error loading NFTs:', err);
            } finally {
                if (mounted) setLoading(false);
            }
        }
        fetchNFTs();
        return () => {
            mounted = false;
        };
    }, [ownerAddress]);

    if (loading) return <p className="muted">Loading NFTs…</p>;
    if (nfts.length === 0) return <p className="muted">No NFTs found for this wallet.</p>;

    return (
        <div className="nft-grid">
            {nfts.map((nft, i) => (
                <div key={i} className="nft-card">
                    <div className="nft-media">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={nft.image_url} alt={nft.name || 'NFT'} />
                    </div>
                    <div className="nft-info">
                        {nft.name && <h3 className="nft-title">{nft.name}</h3>}
                        {nft.description && <p className="nft-desc">{nft.description}</p>}
                    </div>
                </div>
            ))}
        </div>
    );
}


