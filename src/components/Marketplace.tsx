import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import { CONTRACTPACKAGEID, MARKETPLACE_MODULE, LISTING_STRUCT_NAME, BUY_METHOD, CANCEL_METHOD, MARKETPLACE_ID, LIST_METHOD } from '../configs/constants';

type Listing = {
    objectId: string;
    nftId: string;
    price: bigint; // in Mist
    seller: string;
};

function formatSui(mist: bigint) {
    const n = Number(mist) / 1_000_000_000;
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 9 })} SUI`;
}

export default function Marketplace() {
    const account = useCurrentAccount();
    const suiClient = useSuiClient();
    const qc = useQueryClient();
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();
    const [cursor, setCursor] = useState<string | null>(null);

    const structType = `${CONTRACTPACKAGEID}::${MARKETPLACE_MODULE}::${LISTING_STRUCT_NAME}`;

    const { data = { items: [], next: null, prev: null }, isLoading, isFetching } = useQuery<{ items: Listing[]; next: string | null; prev: string | null }>({
        queryKey: ['listings', structType, cursor],
        queryFn: async () => {
            const clientAny: any = suiClient as any;
            if (!clientAny.queryObjects) return { items: [], next: null, prev: null };

            // Primary: exact struct type
            const respExact: any = await clientAny.queryObjects({
                filter: { StructType: structType },
                options: { showContent: true },
                limit: 20,
                cursor: cursor || undefined,
            });
            let items: Listing[] = (respExact.data as any[])
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

            // Fallback: by package, filter by module::struct on client
            if (items.length === 0) {
                const respPkg: any = await clientAny.queryObjects({
                    filter: { Package: CONTRACTPACKAGEID },
                    options: { showContent: true },
                    limit: 50,
                });
                const needle = `::${MARKETPLACE_MODULE}::${LISTING_STRUCT_NAME}`;
                items = (respPkg.data as any[])
                    .map((o: any) => o.data)
                    .filter((d: any) => !!d && d.content?.dataType === 'moveObject')
                    .filter((d: any) => String(d.content.type || '').includes(needle))
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
                if (items.length > 0) {
                    return { items, next: null, prev: null } as { items: Listing[]; next: string | null; prev: string | null };
                }
            }

            // Fallback 2: derive listing object IDs from recent list transactions (no manual type config required)
            if (items.length === 0) {
                const txResp: any = await clientAny.queryTransactionBlocks({
                    filter: {
                        MoveFunction: {
                            package: CONTRACTPACKAGEID,
                            module: MARKETPLACE_MODULE,
                            function: LIST_METHOD,
                        },
                    },
                    options: { showObjectChanges: true },
                    limit: 25,
                    order: 'descending',
                });
                const createdIds: string[] = [];
                for (const tx of txResp.data as any[]) {
                    const changes = (tx.objectChanges as any[]) || [];
                    for (const ch of changes) {
                        if (ch.type === 'created') {
                            const typ = String(ch.objectType || '');
                            if (!typ.includes(`::${MARKETPLACE_MODULE}::`) || (LISTING_STRUCT_NAME && !typ.endsWith(`::${LISTING_STRUCT_NAME}`))) continue;
                            createdIds.push(ch.objectId as string);
                        }
                    }
                }
                const fetched: Listing[] = [];
                for (const id of createdIds.slice(0, 20)) {
                    try {
                        const obj = await suiClient.getObject({ id, options: { showContent: true } });
                        const data: any = (obj as any).data;
                        const content: any = data?.content;
                        if (content?.dataType !== 'moveObject') continue;
                        const fields: any = content.fields;
                        const nftId = (fields?.nft_id?.id ?? fields?.nft_id ?? '') as any;
                        fetched.push({
                            objectId: id,
                            nftId: String(nftId),
                            price: BigInt(fields?.price ?? 0),
                            seller: String(fields?.seller ?? ''),
                        });
                    } catch {}
                }
                items = fetched;
                return { items, next: null, prev: null } as { items: Listing[]; next: string | null; prev: string | null };
            }

            return { items, next: respExact.nextCursor ?? null, prev: respExact.prevCursor ?? null } as { items: Listing[]; next: string | null; prev: string | null };
        },
        initialData: { items: [], next: null, prev: null },
    });

    const onBuy = (listing: Listing) => {
        if (!account) return;
        const txb = new Transaction();
        const payment = txb.splitCoins(txb.gas, [txb.pure.u64(listing.price)]);
        txb.moveCall({
            target: `${CONTRACTPACKAGEID}::${MARKETPLACE_MODULE}::${BUY_METHOD}`,
            arguments: [
                txb.object(listing.objectId),
                payment,
                txb.object(MARKETPLACE_ID),
            ],
        });
        signAndExecute(
            { transaction: txb },
            {
                onSuccess: async ({ digest }) => {
                    await suiClient.waitForTransaction({ digest });
                    qc.invalidateQueries({ queryKey: ['listings'] });
                    qc.invalidateQueries({ queryKey: ['owned-nfts'] });
                },
            },
        );
    };

    const onCancel = (listing: Listing) => {
        if (!account) return;
        const txb = new Transaction();
        txb.moveCall({
            target: `${CONTRACTPACKAGEID}::${MARKETPLACE_MODULE}::${CANCEL_METHOD}`,
            arguments: [txb.object(listing.objectId)],
        });
        signAndExecute(
            { transaction: txb },
            {
                onSuccess: async ({ digest }) => {
                    await suiClient.waitForTransaction({ digest });
                    qc.invalidateQueries({ queryKey: ['listings'] });
                    qc.invalidateQueries({ queryKey: ['owned-nfts'] });
                },
            },
        );
    };

    const listings = data.items ?? [];

    return (
        <section id="marketplace" className="section">
            <div className="container">
                <div className="section-head">
                    <h2>Marketplace</h2>
                    {(isLoading || isFetching) && <p className="muted">Loading listings…</p>}
                </div>
                {listings.length > 0 ? (
                    <div className="nft-grid">
                        {listings.map((l) => (
                            <div key={l.objectId} className="nft-card">
                                <div className="nft-info">
                                    <div className="nft-title">Listing</div>
                                    <div className="nft-desc">NFT ID: {l.nftId}</div>
                                    <div className="nft-desc">Price: {formatSui(l.price)}</div>
                                    <div className="nft-desc">Seller: {l.seller}</div>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                        <button className="button primary" onClick={() => onBuy(l)} disabled={!account}>Buy</button>
                                        {account && account.address.toLowerCase() === l.seller.toLowerCase() && (
                                            <button className="button" onClick={() => onCancel(l)}>Cancel</button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    !isLoading && <p className="muted">No listings found.</p>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <button className="button" disabled={!data.prev} onClick={() => setCursor(data.prev ?? null)}>Prev</button>
                    <button className="button" disabled={!data.next} onClick={() => setCursor(data.next ?? null)}>Next</button>
                </div>
            </div>
        </section>
    );
}


