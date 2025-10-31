import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';
import NFTCard from './NFTCard';
import { CONTRACTPACKAGEID, CONTRACTMODULENAME, NFT_STRUCT_NAME, PUBLIC_GALLERY_ADDRESS, MARKETPLACE_MODULE, LISTING_STRUCT_NAME } from '../configs/constants';
import NFTGalleryDisplay from './NFTGalleryDisplay';

export default function Home() {
    const suiClient = useSuiClient();
    const account = useCurrentAccount();
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

    // Public listings feed (homepage) — lightweight view without actions
    type Listing = { objectId: string; nftId: string; price: bigint; seller: string };
    type ListingWithPreview = Listing & { imageUrl?: string; name?: string; description?: string };
    const listingStructType = `${CONTRACTPACKAGEID}::${MARKETPLACE_MODULE}::${LISTING_STRUCT_NAME}`;
    const { data: homeListings = [], isLoading: loadingListings } = useQuery<ListingWithPreview[]>({
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
                            imageUrl = String(disp.image_url || disp.image || '');
                            name = disp.name ? String(disp.name) : undefined;
                            description = disp.description ? String(disp.description) : undefined;
                        }
                        if (!imageUrl) {
                            const content: any = data?.content;
                            const fields: any = content?.dataType === 'moveObject' ? content.fields : undefined;
                            if (fields?.url) imageUrl = String(fields.url);
                            if (!name && fields?.name) name = String(fields.name);
                            if (!description && fields?.description) description = String(fields.description);
                        }
                    } catch {}
                }
                enriched.push({ ...l, imageUrl, name, description });
            }
            return enriched;
        },
        initialData: [],
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
                <div className="section" style={{ paddingTop: 24 }}>
                    <div className="section-head">
                        <h3>Latest Listings</h3>
                        {loadingListings && <p className="muted">Loading listings…</p>}
                        {!loadingListings && homeListings.length === 0 && <p className="muted">No listings found.</p>}
                    </div>
                    {homeListings.length > 0 && (
                        <div className="nft-grid">
                            {homeListings.map((l) => (
                                <NFTCard key={l.objectId} imageUrl={l.imageUrl || ''} name={l.name || `Listing`} description={`Price: ${(Number(l.price)/1_000_000_000).toFixed(3)} SUI • Seller: ${l.seller.substring(0,10)}…`} />
                            ))}
                        </div>
                    )}
                </div>
                {account && (
                    <div className="section" style={{ paddingTop: 24 }}>
                        <div className="section-head">
                            <h3>Wallet NFTs (Display metadata)</h3>
                        </div>
                        <NFTGalleryDisplay ownerAddress={account.address} />
                    </div>
                )}
                {!account && PUBLIC_GALLERY_ADDRESS && (
                    <div className="section" style={{ paddingTop: 24 }}>
                        <div className="section-head">
                            <h3>Public Wallet NFTs (Display metadata)</h3>
                        </div>
                        <NFTGalleryDisplay ownerAddress={PUBLIC_GALLERY_ADDRESS} />
                    </div>
                )}
            </div>
        </section>
    );
}


