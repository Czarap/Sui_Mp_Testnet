import NFTCard from './NFTCard';
import { useNftContext } from '../context/NftContext';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';
import { CONTRACTPACKAGEID, CONTRACTMODULENAME, NFT_STRUCT_NAME } from '../configs/constants';
import { LIST_METHOD, MARKETPLACE_MODULE } from '../configs/constants';
import { Transaction } from '@mysten/sui/transactions';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

function Gallery() {
    const { mintedNfts } = useNftContext();
    const account = useCurrentAccount();
    const suiClient = useSuiClient();
    const qc = useQueryClient();
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();

    const structType = CONTRACTPACKAGEID && CONTRACTMODULENAME && NFT_STRUCT_NAME
        ? `${CONTRACTPACKAGEID}::${CONTRACTMODULENAME}::${NFT_STRUCT_NAME}`
        : '';

    // When connected: fetch NFTs owned by the wallet
    const { data: chainNfts = [], isLoading } = useQuery({
        queryKey: ['owned-nfts', account?.address, structType],
        enabled: !!account && !!structType,
        queryFn: async () => {
            const resp = await suiClient.getOwnedObjects({
                owner: account!.address,
                filter: structType ? { StructType: structType } : undefined,
                options: { showContent: true },
            });
            return resp.data
                .map((o) => o.data)
                .filter((d): d is NonNullable<typeof d> => !!d && d.content?.dataType === 'moveObject')
                .map((d) => {
                    const fields: any = (d.content as any).fields;
                    return {
                        objectId: d.objectId,
                        name: String(fields.name ?? ''),
                        description: String(fields.description ?? ''),
                        imageUrl: String(fields.url ?? ''),
                    };
                });
        },
    });

    // When not connected: fetch a public feed of recent NFTs by type
    const { data: publicNfts = [], isLoading: isLoadingPublic } = useQuery({
        queryKey: ['public-nfts', structType],
        enabled: !!structType,
        queryFn: async () => {
            // Fallback to any-typed queryObjects for SDKs that expose it; otherwise return empty feed
            const clientAny: any = suiClient as any;
            if (!clientAny.queryObjects) return [] as any[];
            const resp: any = await clientAny.queryObjects({
                filter: { StructType: structType },
                options: { showContent: true },
                limit: 24,
            });
            return (resp.data as any[])
                .map((o: any) => o.data)
                .filter((d: any) => !!d && d.content?.dataType === 'moveObject')
                .map((d: any) => {
                    const fields: any = (d.content as any).fields;
                    return {
                        objectId: d.objectId as string,
                        name: String(fields.name ?? ''),
                        description: String(fields.description ?? ''),
                        imageUrl: String(fields.url ?? ''),
                    } as any;
                });
        },
    });

    // Merge session-minted and chain-loaded, de-dupe by objectId (session ones first)
    const seen = new Set<string>();
    const merged = [
        ...mintedNfts,
        ...chainNfts,
    ].filter((nft) => {
        if (seen.has(nft.objectId)) return false;
        seen.add(nft.objectId);
        return true;
    });

    const feed = publicNfts.length > 0 ? publicNfts : (account ? merged : publicNfts);
    const loading = isLoadingPublic || (account && publicNfts.length === 0 ? isLoading : false);
    const hasItems = feed.length > 0;

    const onList = (nftObjectId: string, priceSui: string) => {
        if (!account) return;
        const price = Number(priceSui);
        if (!isFinite(price) || price <= 0) return;
        const mist = BigInt(Math.floor(price * 1_000_000_000));
        const txb = new Transaction();
        // Many listing functions take an ID, not the full object. Use ID for compatibility.
        txb.moveCall({
            target: `${CONTRACTPACKAGEID}::${MARKETPLACE_MODULE}::${LIST_METHOD}`,
            arguments: [txb.pure.id(nftObjectId), txb.pure.u64(mist)],
        });
        signAndExecute(
            { transaction: txb as any },
            {
                onSuccess: async ({ digest }) => {
                    await suiClient.waitForTransaction({ digest });
                    qc.invalidateQueries({ queryKey: ['listings'] });
                },
            },
        );
    };
    return (
        <section id="gallery" className="section">
            <div className="container">
                <div className="section-head">
                    <h2>{account ? 'Your Minted NFTs' : 'Latest NFTs'}</h2>
                    {loading && <p className="muted">Loading NFTs…</p>}
                    {!loading && !hasItems && (
                        <p className="muted">No NFTs found{account ? ' for this wallet' : ''}.</p>
                    )}
                </div>
                {hasItems && (
                    <div className="nft-grid">
                        {feed.map((nft) => {
                            const isOwnedView = !!account;
                            return (
                                <div key={nft.objectId}>
                                    <NFTCard imageUrl={nft.imageUrl} name={nft.name} description={nft.description} />
                                    {isOwnedView && (
                                        <ListControl onList={(price) => onList(nft.objectId, price)} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}

function ListControl({ onList }: { onList: (priceSui: string) => void }) {
    const [price, setPrice] = useState('');
    return (
        <div className="mint-form" style={{ marginTop: 8 }}>
            <label className="field">
                <span className="label">List Price (SUI)</span>
                <input className="input" type="number" min="0" step="0.000000001" value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
            <button className="button" onClick={() => onList(price)} disabled={!price}>List for Sale</button>
        </div>
    );
}

export default Gallery;


