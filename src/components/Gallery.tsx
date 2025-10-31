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
    const decodeField = (v: any): string => {
        if (typeof v === 'string') return v;
        if (Array.isArray(v)) {
            try { return new TextDecoder().decode(Uint8Array.from(v)); } catch { return ''; }
        }
        return '';
    };
    const { mintedNfts } = useNftContext();
    const account = useCurrentAccount();
    const suiClient = useSuiClient();
    const qc = useQueryClient();
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();
    const [listError, setListError] = useState<string | null>(null);

    const structType = CONTRACTPACKAGEID && CONTRACTMODULENAME && NFT_STRUCT_NAME
        ? `${CONTRACTPACKAGEID}::${CONTRACTMODULENAME}::${NFT_STRUCT_NAME}`
        : '';

    // When connected: fetch NFTs owned by the wallet
    const { data: chainNfts = [] } = useQuery({
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
                        name: decodeField(fields.name),
                        description: decodeField(fields.description),
                        imageUrl: decodeField(fields.url),
                    };
                });
        },
    });

    // When not connected: fetch a public feed of recent NFTs by type
    const { data: publicNfts = [] } = useQuery({
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
            let items = (resp.data as any[])
                .map((o: any) => o.data)
                .filter((d: any) => !!d && d.content?.dataType === 'moveObject')
                .map((d: any) => {
                    const fields: any = (d.content as any).fields;
                    return {
                        objectId: d.objectId as string,
                        name: decodeField(fields.name),
                        description: decodeField(fields.description),
                        imageUrl: decodeField(fields.url),
                    } as any;
                });
            // Package fallback in case the NFT struct name/module differ
            if (items.length === 0) {
                const respPkg: any = await clientAny.queryObjects({
                    filter: { Package: CONTRACTPACKAGEID },
                    options: { showContent: true },
                    limit: 50,
                });
                items = (respPkg.data as any[])
                    .map((o: any) => o.data)
                    .filter((d: any) => !!d && d.content?.dataType === 'moveObject')
                    .map((d: any) => {
                        const fields: any = (d.content as any).fields;
                        return {
                            objectId: d.objectId as string,
                            name: decodeField(fields?.name),
                            description: decodeField(fields?.description),
                            imageUrl: decodeField(fields?.url),
                        } as any;
                    })
                    .filter((n: any) => n.imageUrl || n.name || n.description);
            }
            // Event fallback: MintNFTEvent → fetch object_id
            if (items.length === 0 && clientAny.queryTransactionBlocks) {
                const eventType = `${CONTRACTPACKAGEID}::${CONTRACTMODULENAME}::MintNFTEvent`;
                const txs: any = await clientAny.queryTransactionBlocks({
                    filter: { MoveEventType: eventType },
                    options: { showEvents: true },
                    limit: 20,
                    order: 'descending',
                });
                const ids: string[] = [];
                for (const tx of txs.data as any[]) {
                    const evs: any[] = tx.events || [];
                    for (const ev of evs) {
                        if (ev.type === eventType && ev.parsedJson?.object_id) ids.push(String(ev.parsedJson.object_id));
                    }
                }
                for (const id of ids) {
                    try {
                        const o: any = await suiClient.getObject({ id, options: { showContent: true } });
                        const data: any = o?.data; const content: any = data?.content;
                        if (content?.dataType !== 'moveObject') continue;
                        const f: any = content.fields;
                        items.push({ objectId: id, name: decodeField(f?.name), description: decodeField(f?.description), imageUrl: decodeField(f?.url) });
                    } catch {}
                }
            }
            return items;
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
    const hasItems = feed.length > 0;

    const onList = async (nftObjectId: string, priceSui: string) => {
        if (!account) return;
        setListError(null);
        // Ensure current wallet owns the NFT
        try {
            const obj = await suiClient.getObject({ id: nftObjectId, options: { showOwner: true } });
            const owner = (obj as any)?.data?.owner?.AddressOwner;
            if (!owner || owner.toLowerCase() !== account.address.toLowerCase()) {
                setListError('You must own this NFT in the connected wallet to list it.');
                return;
            }
        } catch {
            // ignore owner check failures
        }
        const price = Number(priceSui);
        if (!isFinite(price) || price <= 0) return;
        const mist = BigInt(Math.floor(price * 1_000_000_000));
        const txb = new Transaction();
        // Pass the full object; many list functions require the owned object, not just its ID
        txb.moveCall({
            target: `${CONTRACTPACKAGEID}::${MARKETPLACE_MODULE}::${LIST_METHOD}`,
            arguments: [txb.object(nftObjectId), txb.pure.u64(mist)],
        });
        signAndExecute(
            { transaction: txb as any },
            {
                onSuccess: async ({ digest }) => {
                    await suiClient.waitForTransaction({ digest });
                    qc.invalidateQueries({ queryKey: ['listings'] });
                },
                onError: (e) => {
                    setListError(String(e));
                },
            },
        );
    };
    return (
        <section id="gallery" className="section">
            <div className="container">
                {hasItems && (
                    <div className="section-head">
                        <h2>{account ? 'Your Minted NFTs' : 'Latest NFTs'}</h2>
                    </div>
                )}
                {hasItems && (
                    <div className="nft-grid">
                        {feed.map((nft) => {
                            const isOwnedView = !!account;
                            return (
                                <div key={nft.objectId}>
                                    <NFTCard imageUrl={nft.imageUrl} name={nft.name} description={nft.description} />
                                    {isOwnedView && (
                                        <>
                                            <ListControl onList={(price) => onList(nft.objectId, price)} />
                                            {listError && <p className="muted" style={{ color: '#ffb3ae' }}>{listError}</p>}
                                        </>
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


