import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';
import NFTCard from './NFTCard';
import { CONTRACTPACKAGEID, CONTRACTMODULENAME, NFT_STRUCT_NAME, MARKETPLACE_MODULE, LISTING_STRUCT_NAME, BUY_METHOD, MARKETPLACE_ID, CANCEL_METHOD } from '../configs/constants';
import NFTGalleryDisplay from './NFTGalleryDisplay';
import { Transaction } from '@mysten/sui/transactions';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

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
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();
    const qc = useQueryClient();
    const [galleryRefresh, setGalleryRefresh] = useState(0);
    const structType = CONTRACTPACKAGEID && CONTRACTMODULENAME && NFT_STRUCT_NAME
        ? `${CONTRACTPACKAGEID}::${CONTRACTMODULENAME}::${NFT_STRUCT_NAME}`
        : '';

    const { data: publicNfts = [], isLoading } = useQuery({
        queryKey: ['home-public-nfts', structType],
        enabled: !!structType,
        queryFn: async () => {
            const clientAny: any = suiClient as any;
            if (!clientAny.queryObjects) return [] as any[];
            const resp: any = await clientAny.queryObjects({
                filter: { StructType: structType },
                options: { showContent: true },
                limit: 36,
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
            // Fallback to recent MintNFTEvent events → fetch those object IDs
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
                        items.push({
                            objectId: id,
                            name: decodeField(f?.name),
                            description: decodeField(f?.description),
                            imageUrl: decodeField(f?.url),
                        });
                    } catch {}
                }
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

    // My minted NFTs (by event), enriched with listing state; shows even when NFT is listed (not owned)
    type MyMinted = { objectId: string; name?: string; description?: string; imageUrl?: string; listingId?: string };
    const { data: myMinted = [] } = useQuery<MyMinted[]>({
        queryKey: ['my-minted', account?.address],
        enabled: !!account,
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

    return (
        <section id="home" className="section">
            <div className="container">
                <div className="section-head">
                    <h2>All Minted NFTs</h2>
                    {isLoading && <p className="muted">Loading NFTs…</p>}
                    {!isLoading && publicNfts.length === 0 && <p className="muted">No NFTs found.</p>}
                </div>
                {publicNfts.length > 0 && (
                    <div className="nft-grid">
                        {publicNfts.map((nft: any) => (
                            <NFTCard key={nft.objectId} imageUrl={nft.imageUrl} name={nft.name} description={nft.description} />
                        ))}
                    </div>
                )}
                {account && myMinted.length > 0 && (
                    <div className="section" style={{ paddingTop: 24 }}>
                        <div className="section-head">
                            <h3>My Minted</h3>
                        </div>
                        <div className="nft-grid">
                            {myMinted.map((m) => (
                                <div key={m.objectId}>
                                    <NFTCard imageUrl={m.imageUrl || ''} name={m.name || 'Minted NFT'} description={m.description || ''} />
                                    {m.listingId && (
                                        <button
                                            className="button"
                                            onClick={() => {
                                                const txb = new Transaction();
                                                txb.moveCall({
                                                    target: `${CONTRACTPACKAGEID}::${MARKETPLACE_MODULE}::${CANCEL_METHOD}`,
                                                    arguments: [txb.object(m.listingId!)],
                                                });
                                                signAndExecute(
                                                    { transaction: txb as any },
                                                    {
                                                        onSuccess: async ({ digest }) => {
                                                            await suiClient.waitForTransaction({ digest });
                                                            qc.invalidateQueries({ queryKey: ['my-minted'] });
                                                            qc.invalidateQueries({ queryKey: ['home-listings'] });
                                                        },
                                                    },
                                                );
                                            }}
                                        >
                                            Cancel Listing
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {homeListings.length > 0 && (
                    <div className="section" style={{ paddingTop: 24 }}>
                        <div className="section-head">
                            <h3>Latest Listings</h3>
                        </div>
                        <div className="nft-grid">
                            {homeListings.map((l) => (
                                <div key={l.objectId}>
                                    <NFTCard imageUrl={l.imageUrl || ''} name={l.name || `Listing`} description={`Price: ${(Number(l.price)/1_000_000_000).toFixed(3)} SUI • Seller: ${l.seller.substring(0,10)}…`} />
                                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                        <button
                                            className="button primary"
                                            disabled={!account || account.address.toLowerCase() === l.seller.toLowerCase()}
                                            onClick={() => {
                                                if (!account || account.address.toLowerCase() === l.seller.toLowerCase()) return;
                                                const txb = new Transaction();
                                                const payment = txb.splitCoins(txb.gas, [txb.pure.u64(l.price)]);
                                                txb.moveCall({
                                                    target: `${CONTRACTPACKAGEID}::${MARKETPLACE_MODULE}::${BUY_METHOD}`,
                                                    arguments: [txb.object(l.objectId), payment, txb.object(MARKETPLACE_ID)],
                                                });
                                                signAndExecute(
                                                    { transaction: txb as any },
                                                    {
                                                        onSuccess: async ({ digest }) => {
                                                            await suiClient.waitForTransaction({ digest });
                                                            qc.invalidateQueries({ queryKey: ['home-listings'] });
                                                            qc.invalidateQueries({ queryKey: ['owned-nfts'] });
                                                            setGalleryRefresh((x) => x + 1);
                                                        },
                                                    },
                                                );
                                            }}
                                        >
                                            {account && account.address.toLowerCase() === l.seller.toLowerCase() ? 'Your Listing' : 'Buy'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {/* Removed wallet display gallery to avoid duplication with Minted NFTs section */}
                {account && (
                    <div className="section" style={{ paddingTop: 24 }}>
                        <div className="section-head">
                            <h3>Gallery</h3>
                        </div>
                        <NFTGalleryDisplay ownerAddress={account.address} key={account.address + ':' + galleryRefresh} />
                    </div>
                )}
            </div>
        </section>
    );
}


