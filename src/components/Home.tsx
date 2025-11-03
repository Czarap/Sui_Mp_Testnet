import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';
import NFTCard from './NFTCard';
import { CONTRACTPACKAGEID, CONTRACTMODULENAME, MARKETPLACE_MODULE, LISTING_STRUCT_NAME, BUY_METHOD, MARKETPLACE_ID, NFT_STRUCT_NAME, CANCEL_METHOD } from '../configs/constants';
import NFTGalleryDisplay from './NFTGalleryDisplay';
import { Transaction } from '@mysten/sui/transactions';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useRef } from 'react';

export default function Home() {
    const suiClient = useSuiClient();
    const account = useCurrentAccount();
    const decodeField = (v: any): string => {
        if (typeof v === 'string') return v;
        if (Array.isArray(v)) {
            try { return new TextDecoder().decode(Uint8Array.from(v)); } catch { return ''; }
        }
        return '';
    };
    const qc = useQueryClient();
    const [galleryRefresh, setGalleryRefresh] = useState(0);
    // structType not required for All Minted after switching to package-wide fetch

    const { data: ownedIds = [] } = useQuery({
        queryKey: ['owned-ids', account?.address],
        enabled: !!account,
        queryFn: async () => {
            const resp = await suiClient.getOwnedObjects({ owner: account!.address, options: { showContent: true } });
            return resp.data.map((e: any) => String(e.data?.objectId || '').toLowerCase());
        },
        initialData: [],
    });

    // NFTs minted by the connected wallet (even if transferred/listed) — event-based
    type MyMintedCard = { objectId: string; name?: string; description?: string; imageUrl?: string };
    const { data: myMintedExtra = [] } = useQuery<MyMintedCard[]>({
        queryKey: ['my-minted-extra', account?.address],
        enabled: !!account,
        queryFn: async () => {
            const clientAny: any = suiClient as any;
            if (!clientAny.queryTransactionBlocks) return [];
            const eventType = `${CONTRACTPACKAGEID}::${CONTRACTMODULENAME}::MintNFTEvent`;
            const txs: any = await clientAny.queryTransactionBlocks({
                filter: { MoveEventType: eventType },
                options: { showEvents: true },
                limit: 80,
                order: 'descending',
            });
            const ids: string[] = [];
            for (const tx of txs.data as any[]) {
                const evs: any[] = tx.events || [];
                for (const ev of evs) {
                    const isMine = ev.type === eventType && String(ev.parsedJson?.creator || '').toLowerCase() === account!.address.toLowerCase();
                    if (isMine && ev.parsedJson?.object_id) ids.push(String(ev.parsedJson.object_id));
                }
            }
            const out: MyMintedCard[] = [];
            for (const id of ids) {
                if (ownedIds.includes(id.toLowerCase())) continue; // skip ones already shown in owned gallery
                try {
                    const o: any = await suiClient.getObject({ id, options: { showContent: true, showDisplay: true } as any });
                    const d: any = o?.data; const disp: any = d?.display?.data; const content: any = d?.content;
                    if (content?.dataType !== 'moveObject') continue;
                    const f: any = content.fields;
                    const decode = (v: any) => (typeof v === 'string' ? v : Array.isArray(v) ? new TextDecoder().decode(Uint8Array.from(v)) : '');
                    const name = disp?.name ? decode(disp.name) : decode(f?.name);
                    const description = disp?.description ? decode(disp.description) : decode(f?.description);
                    const imageUrl = decode(disp?.image_url || disp?.image || f?.url || f?.image || f?.image_url || '');
                    out.push({ objectId: id, name, description, imageUrl });
                } catch {}
            }
            return out;
        },
        initialData: [],
    });
    const { data: allMintedNfts = [], isLoading: loadingMinted } = useQuery({
        queryKey: ['all-minted-nfts', CONTRACTPACKAGEID],
        enabled: !!CONTRACTPACKAGEID,
        queryFn: async () => {
            const clientAny: any = suiClient as any;
            const items: any[] = [];
            const txs: any = await clientAny.queryTransactionBlocks({
                filter: {
                    MoveFunction: {
                        package: CONTRACTPACKAGEID,
                        module: CONTRACTMODULENAME,
                        function: 'mint_to_sender',
                    },
                },
                options: { showObjectChanges: true },
                limit: 50,
                order: 'descending',
            });
            const ids: string[] = [];
            for (const tx of txs.data as any[]) {
                const oc: any[] = tx.objectChanges || [];
                for (const ch of oc) {
                    if (ch.type === 'created' && String(ch.objectType || '').endsWith(`::${NFT_STRUCT_NAME}`)) {
                        ids.push(ch.objectId as string);
                    }
                }
            }
            for (const id of ids.slice(0, 50)) {
                try {
                    const o: any = await suiClient.getObject({ id, options: { showContent: true, showDisplay: true } as any });
                    const d: any = o?.data; const disp: any = d?.display?.data; const content: any = d?.content;
                    if (content?.dataType !== 'moveObject') continue;
                    const f: any = content.fields;
                    const name = disp?.name ? decodeField(disp.name) : decodeField(f?.name);
                    const description = disp?.description ? decodeField(disp.description) : decodeField(f?.description);
                    const img = decodeField(disp?.image_url || disp?.image || f?.url || f?.image || f?.image_url || '');
                    items.push({ objectId: id, name: name || 'Unnamed NFT', description: description || `Object ID: ${id}`, imageUrl: img || 'https://picsum.photos/seed/sui/600/600' });
                } catch {}
            }
            return items;
        },
    });

    // Public listings feed (homepage) — lightweight view without actions
    type Listing = { objectId: string; nftId: string; price: bigint; seller: string };
    type ListingWithPreview = Listing & { imageUrl?: string; name?: string; description?: string };
    const listingStructType = `${CONTRACTPACKAGEID}::${MARKETPLACE_MODULE}::${LISTING_STRUCT_NAME}`;
    const { data: homeListings = [] } = useQuery<ListingWithPreview[]>({
        queryKey: ['home-listings', listingStructType],
        enabled: !!CONTRACTPACKAGEID && !!MARKETPLACE_MODULE && !!LISTING_STRUCT_NAME,
        queryFn: async () => {
            const clientAny: any = suiClient as any;
            const out: Listing[] = [];
            if (clientAny.queryObjects) {
                const resp: any = await clientAny.queryObjects({
                    filter: { StructType: listingStructType },
                    options: { showContent: true },
                    limit: 36,
                });
                const items: Listing[] = (resp.data as any[])
                    .map((o: any) => o.data)
                    .filter((d: any) => !!d && d.content?.dataType === 'moveObject')
                    .map((d: any) => {
                        const fields: any = (d.content as any).fields;
                        const nftId = (fields?.nft_id?.id ?? fields?.nft_id ?? '') as any;
                        return {
                            objectId: d.objectId as string,
                            nftId: String(nftId),
                            price: BigInt(fields.price ?? 0),
                            seller: String(fields.seller ?? ''),
                        } as Listing;
                    });
                out.push(...items);
            }
            if (out.length === 0 && (suiClient as any).queryTransactionBlocks) {
                const txs: any = await (suiClient as any).queryTransactionBlocks({
                    filter: { MoveFunction: { package: CONTRACTPACKAGEID, module: MARKETPLACE_MODULE } },
                    options: { showObjectChanges: true },
                    limit: 25,
                });
                const ids: string[] = [];
                for (const tx of txs.data as any[]) {
                    const oc: any[] = tx.objectChanges || [];
                    for (const ch of oc) {
                        if (ch.type === 'created' && String(ch.objectType || '').endsWith(`::${LISTING_STRUCT_NAME}`)) ids.push(ch.objectId);
                    }
                }
                for (const id of ids.slice(0, 24)) {
                    try {
                        const o = await suiClient.getObject({ id, options: { showContent: true } });
                        const data: any = (o as any).data; const content: any = data?.content;
                        if (content?.dataType !== 'moveObject') continue;
                        const f: any = content.fields; const nftId = (f?.nft_id?.id ?? f?.nft_id ?? '') as any;
                        out.push({ objectId: id, nftId: String(nftId), price: BigInt(f?.price ?? 0), seller: String(f?.seller ?? '') });
                    } catch {}
                }
            }

            // Enrich listings with NFT previews (display metadata preferred, fallback to content fields.url)
            const enriched: ListingWithPreview[] = [];
            for (const l of out.slice(0, 36)) {
                let imageUrl: string | undefined;
                let name: string | undefined;
                let description: string | undefined;
                if (l.nftId) {
                    try {
                        const o: any = await suiClient.getObject({ id: l.nftId, options: { showContent: true, showDisplay: true } as any });
                        const data: any = o?.data;
                        const disp: any = data?.display?.data;
                        if (disp) {
                            imageUrl = decodeField(disp.image_url || disp.image || '');
                            name = disp.name ? decodeField(disp.name) : undefined;
                            description = disp.description ? decodeField(disp.description) : undefined;
                        }
                        if (!imageUrl) {
                            const content: any = data?.content;
                            const fields: any = content?.dataType === 'moveObject' ? content.fields : undefined;
                            if (fields?.url) imageUrl = decodeField(fields.url);
                            if (!name && fields?.name) name = decodeField(fields.name);
                            if (!description && fields?.description) description = decodeField(fields.description);
                        }
                    } catch {}
                }
                enriched.push({ ...l, imageUrl, name, description });
            }
            return enriched;
        },
        initialData: [],
    });


    // type MyMinted = { objectId: string; name?: string; description?: string; imageUrl?: string; listingId?: string };
    /*
    const { data: myMinted = [] } = useQuery<MyMinted[]>({
        queryKey: ['my-minted', account?.address],
        enabled: false, // retained for future use; disabled now
        queryFn: async () => {
            const clientAny: any = suiClient as any;
            if (!clientAny.queryTransactionBlocks) return [];
            const eventType = `${CONTRACTPACKAGEID}::${CONTRACTMODULENAME}::MintNFTEvent`;
            const txs: any = await clientAny.queryTransactionBlocks({
                filter: { MoveEventType: eventType },
                options: { showEvents: true },
                limit: 50,
                order: 'descending',
            });
            const ids: string[] = [];
            for (const tx of txs.data as any[]) {
                const evs: any[] = tx.events || [];
                for (const ev of evs) {
                    const isMine = ev.type === eventType && String(ev.parsedJson?.creator || '').toLowerCase() === account!.address.toLowerCase();
                    if (isMine && ev.parsedJson?.object_id) ids.push(String(ev.parsedJson.object_id));
                }
            }
            // Fetch NFTs and detect listing objects that reference them
            const results: MyMinted[] = [];
            for (const id of ids) {
                try {
                    const o: any = await suiClient.getObject({ id, options: { showContent: true, showDisplay: true } as any });
                    const data: any = o?.data; const content: any = data?.content; const disp: any = data?.display?.data;
                    const fields: any = content?.dataType === 'moveObject' ? content.fields : undefined;
                    const name = disp?.name ? decodeField(disp.name) : decodeField(fields?.name);
                    const description = disp?.description ? decodeField(disp.description) : decodeField(fields?.description);
                    const imageUrl = disp?.image_url || disp?.image ? decodeField(disp.image_url || disp.image) : decodeField(fields?.url);

                    // Find listing referencing this NFT
                    let listingId: string | undefined;
                    if ((clientAny as any).queryObjects) {
                        const resp: any = await clientAny.queryObjects({
                            filter: { Package: CONTRACTPACKAGEID },
                            options: { showContent: true },
                            limit: 100,
                        });
                        for (const e of resp.data as any[]) {
                            const d: any = e.data; const c: any = d?.content;
                            if (c?.dataType !== 'moveObject') continue;
                            if (!String(c.type || '').endsWith(`::${LISTING_STRUCT_NAME}`)) continue;
                            const f: any = c.fields; const nftRef = f?.nft_id?.id ?? f?.nft_id;
                            if (String(nftRef || '').toLowerCase() === id.toLowerCase()) {
                                listingId = d.objectId; break;
                            }
                        }
                    }
                    results.push({ objectId: id, name, description, imageUrl, listingId });
                } catch {}
            }
            return results;
        },
        initialData: [],
        staleTime: 10_000,
    });
    */

    return (
        <section id="home" className="section">
            <div className="container">
                <div className="section" style={{ paddingTop: 24 }}>
                    <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3>All NFTs</h3>
                            {loadingMinted && <p className="muted">Loading minted NFTs…</p>}
                            {!loadingMinted && allMintedNfts.length === 0 && (
                                <p className="muted">No minted NFTs found yet.</p>
                            )}
                        </div>

                    </div>
                    {allMintedNfts.length > 0 && (
                        <NFTCarousel nfts={allMintedNfts} account={account} />
                    )}
                </div>
           
                {homeListings.length > 0 && (
                    <div className="section" style={{ paddingTop: 24 }}>
                        <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3>Latest Listings</h3>
                        </div>
                        <ListingCarousel listings={homeListings} account={account} onAfterTx={() => {
                            qc.invalidateQueries({ queryKey: ['home-listings'] });
                            qc.invalidateQueries({ queryKey: ['owned-nfts'] });
                            setGalleryRefresh((x) => x + 1);
                        }} />
                    </div>
                )}
                {/* Activity moved to its own page (see Activity.tsx) */}
               
                {account && (
                    <div className="section" style={{ paddingTop: 24 }}>
                        <div className="section-head">
                            <h3>Gallery</h3>
                        </div>
                        <NFTGalleryDisplay ownerAddress={account.address} key={account.address + ':' + galleryRefresh} />
                        {myMintedExtra.length > 0 && (
                            <div className="nft-grid" style={{ marginTop: 16 }}>
                                {myMintedExtra.map((n) => (
                                    <NFTCard key={n.objectId} imageUrl={n.imageUrl || ''} name={n.name || 'Minted NFT'} description={n.description || `Object ID: ${n.objectId}`} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}

function NFTCarousel({ nfts, account }: { nfts: any[]; account: any }) {
    const carouselRef = useRef<HTMLDivElement>(null);
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();
    const qc = useQueryClient();
    const suiClient = useSuiClient();

    const scrollLeft = () => {
        if (carouselRef.current) {
            carouselRef.current.scrollBy({ left: -300, behavior: 'smooth' });
        }
    };

    const scrollRight = () => {
        if (carouselRef.current) {
            carouselRef.current.scrollBy({ left: 300, behavior: 'smooth' });
        }
    };

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={scrollLeft}
                style={{
                    position: 'absolute',
                    left: -20,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 10,
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.85), rgba(0,0,0,0.6))',
                    border: 'none',
                    borderRadius: '50%',
                    width: 40,
                    height: 40,
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                }}
                aria-label="Scroll left"
            >
                ‹
            </button>
            <div
                ref={carouselRef}
                style={{
                    display: 'flex',
                    gap: 16,
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    scrollBehavior: 'smooth',
                    padding: '8px 0',
                    scrollbarWidth: 'none',
                    alignItems: 'stretch',
                }}
                className="no-scrollbar"
            >
                {nfts.map((nft: any) => (
                    <div key={nft.objectId} style={{ minWidth: 280, maxWidth: 280, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <NFTCard imageUrl={nft.imageUrl} name={nft.name} description={nft.description} />
                        </div>
                        {nft.listingId && account && account.address.toLowerCase() === String(nft.seller || '').toLowerCase() && (
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
                                                    qc.invalidateQueries({ queryKey: ['home-listings'] });
                                                    qc.invalidateQueries({ queryKey: ['all-minted-nfts'] });
                                                },
                                            },
                                        );
                                    }}
                                >
                                    Cancel Listing
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <button
                onClick={scrollRight}
                style={{
                    position: 'absolute',
                    right: -20,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 10,
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.85), rgba(0,0,0,0.6))',
                    border: 'none',
                    borderRadius: '50%',
                    width: 40,
                    height: 40,
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                }}
                aria-label="Scroll right"
            >
                ›
            </button>
        </div>
    );
}

function ListingCarousel({ listings, account, onAfterTx }: { listings: any[]; account: any; onAfterTx: () => void }) {
    const carouselRef = useRef<HTMLDivElement>(null);
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();
    const suiClient = useSuiClient();

    const scrollLeft = () => carouselRef.current?.scrollBy({ left: -300, behavior: 'smooth' });
    const scrollRight = () => carouselRef.current?.scrollBy({ left: 300, behavior: 'smooth' });

    return (
        <div style={{ position: 'relative' }}>
            <button onClick={scrollLeft} style={{ position: 'absolute', left: -20, top: '50%', transform: 'translateY(-50%)', zIndex: 10, background: 'linear-gradient(180deg, rgba(0,0,0,0.85), rgba(0,0,0,0.6))', border: 'none', borderRadius: '50%', width: 40, height: 40, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }} aria-label="Scroll left">‹</button>
            <div ref={carouselRef} className="no-scrollbar" style={{ display: 'flex', gap: 16, overflowX: 'auto', overflowY: 'hidden', scrollBehavior: 'smooth', padding: '8px 0', scrollbarWidth: 'none', alignItems: 'stretch' }}>
                {listings.map((l: any) => (
                    <div key={l.objectId} style={{ minWidth: 280, maxWidth: 280, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <NFTCard imageUrl={l.imageUrl || ''} name={l.name || `Listing`} description={`Price: ${(Number(l.price)/1_000_000_000).toFixed(3)} SUI • Seller: ${l.seller.substring(0,10)}…`} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            {account && account.address.toLowerCase() === l.seller.toLowerCase() ? (
                                <button className="button" onClick={() => {
                                    const txb = new Transaction();
                                    txb.moveCall({ target: `${CONTRACTPACKAGEID}::${MARKETPLACE_MODULE}::${CANCEL_METHOD}`, arguments: [txb.object(l.objectId)] });
                                    signAndExecute(
                                        { transaction: txb as any },
                                        { onSuccess: async ({ digest }) => { await suiClient.waitForTransaction({ digest }); onAfterTx(); } },
                                    );
                                }}>Cancel Listing</button>
                            ) : (
                                <button className="button primary" disabled={!account} onClick={() => {
                                    if (!account) return;
                                    const txb = new Transaction();
                                    const payment = txb.splitCoins(txb.gas, [txb.pure.u64(l.price)]);
                                    txb.moveCall({ target: `${CONTRACTPACKAGEID}::${MARKETPLACE_MODULE}::${BUY_METHOD}`, arguments: [txb.object(l.objectId), payment, txb.object(MARKETPLACE_ID)] });
                                    signAndExecute(
                                        { transaction: txb as any },
                                        { onSuccess: async ({ digest }) => { await suiClient.waitForTransaction({ digest }); onAfterTx(); } },
                                    );
                                }}>Buy</button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <button onClick={scrollRight} style={{ position: 'absolute', right: -20, top: '50%', transform: 'translateY(-50%)', zIndex: 10, background: 'linear-gradient(180deg, rgba(0,0,0,0.85), rgba(0,0,0,0.6))', border: 'none', borderRadius: '50%', width: 40, height: 40, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }} aria-label="Scroll right">›</button>
        </div>
    );
}


