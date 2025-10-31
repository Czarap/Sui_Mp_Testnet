import { useSuiClient } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';
import NFTCard from './NFTCard';
import { CONTRACTPACKAGEID, CONTRACTMODULENAME, NFT_STRUCT_NAME } from '../configs/constants';

export default function Home() {
    const suiClient = useSuiClient();
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
            </div>
        </section>
    );
}


