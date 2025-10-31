import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';
import { CONTRACTPACKAGEID, CONTRACTMODULENAME, NFT_STRUCT_NAME } from '../configs/constants';

export default function Marketplace() {
    const account = useCurrentAccount();
    const suiClient = useSuiClient();

    const nftStructType = CONTRACTPACKAGEID && CONTRACTMODULENAME && NFT_STRUCT_NAME
        ? `${CONTRACTPACKAGEID}::${CONTRACTMODULENAME}::${NFT_STRUCT_NAME}`
        : '';

    return (
        <section id="marketplace" className="section">
            <div className="container">
                <PublicNftFeed suiClient={suiClient} nftStructType={nftStructType} />
            </div>
        </section>
    );
}

function PublicNftFeed({ suiClient, nftStructType }: { suiClient: ReturnType<typeof useSuiClient>; nftStructType: string }) {
    const decodeField = (v: any): string => {
        if (typeof v === 'string') return v;
        if (Array.isArray(v)) {
            try { return new TextDecoder().decode(Uint8Array.from(v)); } catch { return ''; }
        }
        return '';
    };

    const { data: publicNfts = [], isLoading } = useQuery({
        queryKey: ['market-nfts', nftStructType],
        enabled: !!nftStructType,
        queryFn: async () => {
            const clientAny: any = suiClient as any;
            let items: any[] = [];

            // 1️⃣ Try getting NFTs via StructType
            if (clientAny.queryObjects) {
                const resp: any = await clientAny.queryObjects({
                    filter: { StructType: nftStructType },
                    options: { showContent: true, showDisplay: true },
                    limit: 50,
                });

                items = (resp.data as any[])
                    .map((o: any) => o.data)
                    .filter((d: any) => !!d && d.content?.dataType === 'moveObject')
                    .map((d: any) => {
                        const fields: any = (d.content as any).fields;
                        const disp: any = d?.display?.data;
                        const imageUrl = decodeField(disp?.image_url || disp?.image || fields?.url || fields?.image || fields?.image_url || '');
                        const name = decodeField(disp?.name || fields?.name || '');
                        const description = decodeField(disp?.description || fields?.description || '');
                        return { objectId: d.objectId as string, name, description, imageUrl };
                    });
            }

            // 2️⃣ Fallback: query by Package to catch older NFTs
            if (items.length === 0 && clientAny.queryObjects) {
                const respPkg: any = await clientAny.queryObjects({
                    filter: { Package: CONTRACTPACKAGEID },
                    options: { showContent: true, showDisplay: true },
                    limit: 50,
                });
                items = (respPkg.data as any[])
                    .map((o: any) => o.data)
                    .filter((d: any) => !!d && d.content?.dataType === 'moveObject')
                    .map((d: any) => {
                        const fields: any = (d.content as any).fields;
                        const disp: any = d?.display?.data;
                        const imageUrl = decodeField(disp?.image_url || disp?.image || fields?.url || fields?.image || fields?.image_url || '');
                        const name = decodeField(disp?.name || fields?.name || '');
                        const description = decodeField(disp?.description || fields?.description || '');
                        return { objectId: d.objectId as string, name, description, imageUrl };
                    })
                    .filter((n: any) => n.imageUrl || n.name || n.description);
            }

            // 3️⃣ Optional: fallback from transactions (recent mints)
            if (items.length === 0 && clientAny.queryTransactionBlocks) {
                const txs: any = await clientAny.queryTransactionBlocks({
                    filter: { MoveFunction: { package: CONTRACTPACKAGEID, module: CONTRACTMODULENAME, function: 'mint_to_sender' } },
                    options: { showObjectChanges: true },
                    limit: 25,
                    order: 'descending',
                });
                const ids: string[] = [];
                for (const tx of txs.data) {
                    for (const ch of tx.objectChanges || []) {
                        if (ch.type === 'created' && String(ch.objectType || '').endsWith(`::${NFT_STRUCT_NAME}`)) {
                            ids.push(ch.objectId);
                        }
                    }
                }
                for (const id of ids.slice(0, 25)) {
                    try {
                        const o: any = await suiClient.getObject({ id, options: { showContent: true, showDisplay: true } as any });
                        const d: any = o?.data;
                        const disp: any = d?.display?.data;
                        const content: any = d?.content;
                        const f: any = content?.fields;
                        const imageUrl = decodeField(disp?.image_url || disp?.image || f?.url || f?.image || f?.image_url || '');
                        const name = decodeField(disp?.name || f?.name || '');
                        const description = decodeField(disp?.description || f?.description || '');
                        items.push({ objectId: id, name, description, imageUrl });
                    } catch { }
                }
            }

            return items;
        },
    });

    if (isLoading) return <p className="muted">Loading NFTs…</p>;
    if (publicNfts.length === 0) return <p className="muted">No NFTs found yet.</p>;

    return (
        <div>
            <div className="section-head">
                <h2>Gallery</h2>
            </div>
            <div className="nft-grid">
                {publicNfts.map((nft: any) => (
                    <div key={nft.objectId} className="nft-card">
                        <div className="nft-media">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={nft.imageUrl || 'https://picsum.photos/seed/sui/600/600'} alt={nft.name || 'NFT'} />
                        </div>
                        <div className="nft-info">
                            {nft.name && <div className="nft-title">{nft.name}</div>}
                            {nft.description && <div className="nft-desc">{nft.description}</div>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
