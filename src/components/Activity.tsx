import { useSuiClient } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';
import { CONTRACTPACKAGEID, MARKETPLACE_MODULE, LISTING_STRUCT_NAME, CONTRACTMODULENAME, NFT_STRUCT_NAME } from '../configs/constants';

type ActivityItem = {
    digest: string;
    timestampMs?: string;
    label: string;
    details?: string;
    nftId?: string;
    listingId?: string;
    seller?: string;
    buyer?: string;
    priceSui?: number;
    imageUrl?: string;
    name?: string;
};

export default function Activity() {
    const suiClient = useSuiClient();

    const { data: activity = [], isLoading } = useQuery<ActivityItem[]>({
        queryKey: ['market-activity-page', CONTRACTPACKAGEID, MARKETPLACE_MODULE],
        enabled: !!CONTRACTPACKAGEID && !!MARKETPLACE_MODULE,
        queryFn: async () => {
            const clientAny: any = suiClient as any;
            const out: ActivityItem[] = [];
            if (!clientAny.queryTransactionBlocks) return out;
            const txs: any = await clientAny.queryTransactionBlocks({
                filter: { MoveFunction: { package: CONTRACTPACKAGEID, module: MARKETPLACE_MODULE } },
                options: { showEvents: true, showInput: true, showEffects: true, showObjectChanges: true },
                limit: 60,
                order: 'descending',
            });
            for (const tx of txs.data as any[]) {
                const digest: string = tx.digest;
                const timestampMs: string | undefined = (tx as any).timestampMs;
                let label = 'Activity';
                let details: string | undefined;
                let nftId: string | undefined;
                let listingId: string | undefined;
                let seller: string | undefined;
                let buyer: string | undefined;
                let priceSui: number | undefined;

                // Check function name first (more reliable than events sometimes)
                const txData: any = (tx as any).transaction?.data?.transaction;
                const moveCall = txData?.MoveCall;
                if (moveCall) {
                    const func = String(moveCall.function || '').toLowerCase();
                    if (func.includes('list') && !func.includes('cancel')) label = 'Listed';
                    else if (func.includes('buy') || func.includes('purchase')) label = 'Bought';
                    else if (func.includes('cancel') || func.includes('delist')) label = 'Canceled';
                    else if (func.includes('mint')) label = 'Minted';
                    else if (func.includes('burn')) label = 'Burned';
                }

                // Check events
                const evs: any[] = (tx.events as any[]) || [];
                for (const ev of evs) {
                    const t = String(ev.type || '');
                    const pj = ev.parsedJson || {};
                    if (t.endsWith('::ListNFTEvent') || t.includes('ListNFTEvent')) { 
                        label = 'Listed'; 
                        nftId = String(pj.nft_id || pj.object_id || pj.nft || pj.id || ''); 
                        seller = String(pj.seller || pj.creator || ''); 
                        if (pj.price) priceSui = Number(pj.price) / 1_000_000_000;
                        listingId = String(pj.listing_id || pj.listing || '');
                    }
                    if (t.endsWith('::PurchaseNFTEvent') || t.includes('PurchaseNFTEvent') || t.includes('BuyNFTEvent')) { 
                        label = 'Bought'; 
                        nftId = String(pj.nft_id || pj.object_id || pj.nft || pj.id || ''); 
                        seller = String(pj.seller || ''); 
                        buyer = String(pj.buyer || ''); 
                        if (pj.price) priceSui = Number(pj.price) / 1_000_000_000;
                        listingId = String(pj.listing_id || pj.listing || '');
                    }
                    if (t.endsWith('::DelistNFTEvent') || t.includes('DelistNFTEvent') || t.includes('CancelListingEvent')) { 
                        label = 'Canceled'; 
                        nftId = String(pj.nft_id || pj.object_id || pj.nft || pj.id || ''); 
                        seller = String(pj.seller || ''); 
                        listingId = String(pj.listing_id || pj.listing || '');
                    }
                    if (t.endsWith('::MintNFTEvent') || t.includes('MintNFTEvent')) {
                        label = 'Minted';
                        nftId = String(pj.object_id || pj.nft_id || pj.nft || pj.id || '');
                        seller = String(pj.creator || pj.sender || '');
                    }
                    if (t.endsWith('::BurnNFTEvent') || t.includes('BurnNFTEvent')) {
                        label = 'Burned';
                        nftId = String(pj.object_id || pj.nft_id || pj.nft || pj.id || '');
                        seller = String(pj.owner || pj.sender || '');
                    }
                }
                
                // Check object changes (created/deleted listings)
                const oc: any[] = (tx.objectChanges as any[]) || [];
                for (const ch of oc) {
                    const objType = String(ch.objectType || '');
                    if (objType.endsWith(`::${LISTING_STRUCT_NAME}`)) {
                        if (ch.type === 'created') {
                            label = 'Listed';
                            listingId = String(ch.objectId);
                        } else if (ch.type === 'deleted') {
                            label = 'Canceled';
                            listingId = String(ch.objectId);
                        }
                    }
                    if (!nftId && NFT_STRUCT_NAME && objType.endsWith(`::${NFT_STRUCT_NAME}`) && ch.type === 'created') {
                        label = 'Minted';
                        nftId = String(ch.objectId);
                    }
                    if (!nftId && NFT_STRUCT_NAME && objType.endsWith(`::${NFT_STRUCT_NAME}`) && ch.type === 'deleted') {
                        label = 'Burned';
                        nftId = String(ch.objectId);
                    }
                }
                
                // Fetch listing details if we found a listingId but missing nftId
                if (listingId && !nftId) {
                    try {
                        const o = await suiClient.getObject({ id: listingId, options: { showContent: true } });
                        const data: any = (o as any).data; const content: any = data?.content;
                        if (content?.dataType === 'moveObject') {
                            const f: any = content.fields;
                            const nftRef = (f?.nft_id?.id ?? f?.nft_id);
                            nftId = nftRef ? String(nftRef) : nftId;
                            seller = seller || String(f?.seller || '');
                            priceSui = priceSui || Number(f?.price ?? 0) / 1_000_000_000;
                        }
                    } catch {}
                }
                
                // Also check inputs for nft_id or listing_id
                const inputs: any[] = (txData?.inputs || []);
                for (const inp of inputs) {
                    if (typeof inp === 'object' && inp.value) {
                        const val = String(inp.value || '');
                        if (val.startsWith('0x') && val.length > 20) {
                            if (!nftId && !listingId) {
                                // Try both
                                try {
                                    const test = await suiClient.getObject({ id: val, options: { showContent: true } });
                                    const testData: any = (test as any).data;
                                    const testContent: any = testData?.content;
                                    if (testContent?.dataType === 'moveObject') {
                                        const testFields: any = testContent.fields;
                                        if (String(testContent.type || '').endsWith(`::${LISTING_STRUCT_NAME}`)) {
                                            listingId = val;
                                            const nftRef = testFields?.nft_id?.id ?? testFields?.nft_id;
                                            if (nftRef) nftId = String(nftRef);
                                            seller = seller || String(testFields?.seller || '');
                                            priceSui = priceSui || Number(testFields?.price ?? 0) / 1_000_000_000;
                                        } else {
                                            nftId = val;
                                        }
                                    }
                                } catch {}
                            }
                        }
                    }
                }
                if (priceSui !== undefined) details = `${priceSui.toFixed(3)} SUI`;
                
                // Only include if it's a valid action
                if (label !== 'Activity' && (label === 'Listed' || label === 'Bought' || label === 'Canceled' || label === 'Minted' || label === 'Burned')) {
                    const item: ActivityItem = { digest, timestampMs, label, details, nftId, listingId, seller, buyer, priceSui };
                    if (nftId) {
                        try {
                            const obj: any = await suiClient.getObject({ id: nftId, options: { showContent: true, showDisplay: true } as any });
                            const d: any = obj?.data; const disp: any = d?.display?.data; const content: any = d?.content;
                            const decode = (v: any): string => typeof v === 'string' ? v : Array.isArray(v) ? new TextDecoder().decode(Uint8Array.from(v)) : '';
                            const fields: any = content?.dataType === 'moveObject' ? content.fields : undefined;
                            const imageUrl = decode((disp?.image_url || disp?.image || fields?.url || fields?.image || fields?.image_url || ''));
                            const name = disp?.name ? decode(disp.name) : decode(fields?.name);
                            item.imageUrl = imageUrl;
                            item.name = name;
                        } catch {}
                    }
                    out.push(item);
                }
            }
            return out;
        },
        initialData: [],
        staleTime: 10_000,
    });

    if (isLoading) return <p className="muted">Loading activity…</p>;

    if (!activity || activity.length === 0) {
        return <p className="muted">Please wait as it takes time to load the activity.</p>;
    }

    return (
        <div className="activity-list" style={{ display: 'grid', gap: 12 }}>
            {activity.map((a) => (
                <div key={a.digest} className="card" style={{ padding: 12, display: 'flex', gap: 12 }}>
                    <div style={{ width: 72, height: 72, background: '#1f1f23', borderRadius: 8, overflow: 'hidden', flex: '0 0 72px' }}>
                        {a.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.imageUrl} alt={a.name || 'NFT'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>NFT</div>
                        )}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <strong>{a.label}</strong>
                                {a.details ? <span className="muted" style={{ marginLeft: 8 }}>{a.details}</span> : null}
                            </div>
                            <a className="muted" href={`https://suiscan.xyz/testnet/object/${a.nftId}`} target="_blank" rel="noreferrer">View</a>
                        </div>
                        <div className="muted" style={{ marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            {a.name && <span>#{a.name}</span>}
                            {a.nftId && <span>NFT: {a.nftId.slice(0,10)}…</span>}
                            {a.seller && <span>Seller: {a.seller.slice(0,10)}…</span>}
                            {a.buyer && <span>Buyer: {a.buyer.slice(0,10)}…</span>}
                            {a.timestampMs && <span>{new Date(Number(a.timestampMs)).toLocaleString()}</span>}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}


