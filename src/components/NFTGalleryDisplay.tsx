import { useEffect, useState } from 'react';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { CONTRACTPACKAGEID, MARKETPLACE_MODULE, LIST_METHOD, LISTING_STRUCT_NAME, CANCEL_METHOD } from '../configs/constants';
import { useQueryClient } from '@tanstack/react-query';
import { useSuiClient } from '@mysten/dapp-kit';

const client = new SuiClient({ url: getFullnodeUrl('testnet') });

type NFTDisplayData = {
    name?: string;
    description?: string;
    image_url?: string;
};

type OwnedNft = {
    objectId: string;
    name?: string;
    description?: string;
    imageUrl?: string;
    listingId?: string; // If this NFT is currently listed
};

export default function NFTGalleryDisplay({ ownerAddress, refreshKey }: { ownerAddress: string; refreshKey?: string | number }) {
    const [nfts, setNfts] = useState<OwnedNft[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();
    const qc = useQueryClient();
    const suiClient = useSuiClient();

    useEffect(() => {
        let mounted = true;
        async function fetchNFTs() {
            try {
                const decode = (v: any): string => {
                    if (typeof v === 'string') return v;
                    if (Array.isArray(v)) {
                        try { return new TextDecoder().decode(Uint8Array.from(v)); } catch { return ''; }
                    }
                    return '';
                };

                const mapped: OwnedNft[] = [];
                const seen = new Set<string>();

                // First: build a map of nft_id -> {listing_id, original_nft_id} for listings where this wallet is the seller
                const nftToListingMap = new Map<string, { listingId: string; originalNftId: string }>();
                try {
                    const clientAny: any = client as any;
                    if (clientAny.queryObjects) {
                        const respListings: any = await clientAny.queryObjects({
                            filter: { StructType: `${CONTRACTPACKAGEID}::${MARKETPLACE_MODULE}::${LISTING_STRUCT_NAME}` },
                            options: { showContent: true },
                            limit: 200,
                        });
                        if (respListings?.data?.length) {
                            for (const e of respListings.data as any[]) {
                                const d: any = e.data; const c: any = d?.content;
                                if (c?.dataType !== 'moveObject') continue;
                                const f: any = c.fields;
                                const seller: string = String(f?.seller || '').toLowerCase();
                                if (seller !== ownerAddress.toLowerCase()) continue;
                                const nftRefOrig = String((f?.nft_id?.id ?? f?.nft_id) || '');
                                const nftRefLower = nftRefOrig.toLowerCase();
                                const listingId = String(d.objectId || '');
                                if (nftRefOrig && listingId) {
                                    nftToListingMap.set(nftRefLower, { listingId, originalNftId: nftRefOrig });
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.warn('Failed to query listings:', err);
                }

                // Second: fetch owned NFTs and mark which ones are listed
                try {
                    const objects = await client.getOwnedObjects({
                        owner: ownerAddress,
                        options: { showDisplay: true, showContent: true } as any,
                    });
                    for (const obj of objects.data as any[]) {
                        const data = obj.data;
                        const objId = String(data?.objectId || '').toLowerCase();
                        if (!objId || seen.has(objId)) continue;
                        seen.add(objId);
                        const disp: NFTDisplayData | undefined = data?.display?.data;
                        const content: any = data?.content;
                        const fields: any = content?.dataType === 'moveObject' ? content.fields : undefined;
                        const name = disp?.name ? decode(disp.name) : decode(fields?.name);
                        const description = disp?.description ? decode(disp.description) : decode(fields?.description);
                        const imageUrl = (() => {
                            const d = disp as any;
                            const f = fields as any;
                            const candidate = d?.image_url || d?.image || f?.url || f?.image || f?.image_url || '';
                            return decode(candidate);
                        })();
                        if (imageUrl || name || description) {
                            const listingInfo = nftToListingMap.get(objId);
                            mapped.push({ objectId: data?.objectId, name, description, imageUrl, listingId: listingInfo?.listingId });
                        }
                    }
                } catch (err) {
                    console.warn('Failed to fetch owned NFTs:', err);
                }

                // Third: also include listed NFTs that are NOT in owned objects (in case ownership transferred to shared object)
                for (const [nftIdLower, listingInfo] of nftToListingMap.entries()) {
                    if (seen.has(nftIdLower)) continue; // Already added from owned objects
                    seen.add(nftIdLower);
                    try {
                        const o: any = await client.getObject({ id: listingInfo.originalNftId, options: { showContent: true, showDisplay: true } as any });
                        const data2: any = o?.data; const disp2: any = data2?.display?.data; const content2: any = data2?.content;
                        if (content2?.dataType !== 'moveObject') continue;
                        const f2: any = content2.fields;
                        const name2 = disp2?.name ? decode(disp2.name) : decode(f2?.name);
                        const desc2 = disp2?.description ? decode(disp2.description) : decode(f2?.description);
                        const img2 = (() => {
                            const d = disp2 as any;
                            const ff = f2 as any;
                            const candidate = d?.image_url || d?.image || ff?.url || ff?.image || ff?.image_url || '';
                            return decode(candidate);
                        })();
                        mapped.push({ objectId: listingInfo.originalNftId, name: name2, description: desc2, imageUrl: img2, listingId: listingInfo.listingId });
                    } catch (err) {
                        console.warn('Failed to fetch listed NFT:', listingInfo.originalNftId, err);
                    }
                }

                if (mounted) setNfts(mapped);
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
    }, [ownerAddress, refreshKey, refreshTrigger]);

    if (loading) return <p className="muted">Loading NFTs…</p>;
    if (nfts.length === 0) return <p className="muted">No NFTs found for this wallet.</p>;

    return (
        <div className="nft-grid">
            {nfts.map((nft, i) => (
                <div key={i} className="nft-card">
                    <div className="nft-media">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={nft.imageUrl || ''} alt={nft.name || 'NFT'} />
                    </div>
                    <div className="nft-info">
                        {nft.name && <h3 className="nft-title">{nft.name}</h3>}
                        {nft.description && <p className="nft-desc">{nft.description}</p>}
                        {nft.listingId ? (
                            <div style={{ marginTop: 8 }}>
                                <button
                                    className="button"
                                    onClick={() => {
                                        const txb = new Transaction();
                                        txb.moveCall({
                                            target: `${CONTRACTPACKAGEID}::${MARKETPLACE_MODULE}::${CANCEL_METHOD}`,
                                            arguments: [txb.object(nft.listingId)],
                                        });
                                        signAndExecute(
                                            { transaction: txb as any },
                                            {
                                                onSuccess: async ({ digest }) => {
                                                    await suiClient.waitForTransaction({ digest });
                                                    qc.invalidateQueries({ queryKey: ['owned-nfts'] });
                                                    setRefreshTrigger((x) => x + 1);
                                                },
                                            }
                                        );
                                    }}
                                >
                                    Cancel Listing
                                </button>
                            </div>
                        ) : (
                            <ListControl objectId={nft.objectId} onList={(priceMist) => {
                                const txb = new Transaction();
                                txb.moveCall({
                                    target: `${CONTRACTPACKAGEID}::${MARKETPLACE_MODULE}::${LIST_METHOD}`,
                                    arguments: [txb.object(nft.objectId), txb.pure.u64(priceMist)],
                                });
                                signAndExecute(
                                    { transaction: txb as any },
                                    {
                                        onSuccess: async ({ digest }) => {
                                            await suiClient.waitForTransaction({ digest });
                                            qc.invalidateQueries({ queryKey: ['owned-nfts'] });
                                            setRefreshTrigger((x) => x + 1);
                                        },
                                    }
                                );
                            }} />
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

function ListControl({ objectId, onList }: { objectId: string; onList: (priceMist: bigint) => void }) {
    const [price, setPrice] = useState('');
    const parsed = Number(price);
    const disabled = !isFinite(parsed) || parsed <= 0;
    return (
        <div className="mint-form" style={{ marginTop: 8 }}>
            <label className="field">
                <span className="label">List Price (SUI)</span>
                <input className="input" type="number" min="0" step="0.000000001" value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
            <button className="button" disabled={disabled} onClick={() => onList(BigInt(Math.floor(parsed * 1_000_000_000)))}>List for Sale</button>
        </div>
    );
}


