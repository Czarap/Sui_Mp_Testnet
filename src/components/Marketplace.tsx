import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';
import { CONTRACTPACKAGEID, CONTRACTMODULENAME, NFT_STRUCT_NAME } from '../configs/constants';

// Simplified marketplace view: shows minted NFTs only

export default function Marketplace() {
    const account = useCurrentAccount();
    const suiClient = useSuiClient();
    const nftStructType = CONTRACTPACKAGEID && CONTRACTMODULENAME && NFT_STRUCT_NAME
        ? `${CONTRACTPACKAGEID}::${CONTRACTMODULENAME}::${NFT_STRUCT_NAME}`
        : '';

    // Removed listing logic; showing minted NFTs only

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
        if (Array.isArray(v)) { try { return new TextDecoder().decode(Uint8Array.from(v)); } catch { return ''; } }
        return '';
    };
    const { data: publicNfts = [] } = useQuery({
        queryKey: ['market-nfts', nftStructType],
        enabled: !!nftStructType,
        queryFn: async () => {
            const clientAny: any = suiClient as any;
            if (!clientAny.queryObjects) return [] as any[];
            const resp: any = await clientAny.queryObjects({
                filter: { StructType: nftStructType },
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
                        name: decodeField(fields?.name),
                        description: decodeField(fields?.description),
                        imageUrl: decodeField(fields?.url),
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
            return items;
        },
    });
    return (
        <div>
            {publicNfts.length > 0 && (
                <>
                <div className="section-head">
                    <h2>Gallery</h2>
                </div>
                <div className="nft-grid">
                    {publicNfts.map((nft: any) => (
                        <div key={nft.objectId} className="nft-card">
                            <div className="nft-media">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={nft.imageUrl} alt={nft.name || 'NFT'} />
                            </div>
                            <div className="nft-info">
                                {nft.name && <div className="nft-title">{nft.name}</div>}
                                {nft.description && <div className="nft-desc">{nft.description}</div>}
                            </div>
                        </div>
                    ))}
                </div>
                </>
            )}
        </div>
    );
}


