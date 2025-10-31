import { createContext, useContext, useMemo, useState, ReactNode } from 'react';

export type MintedNft = {
    objectId: string;
    name: string;
    description: string;
    imageUrl: string;
};

type NftContextValue = {
    mintedNfts: MintedNft[];
    addMintedNft: (nft: MintedNft) => void;
};

const NftContext = createContext<NftContextValue | undefined>(undefined);

export function NftProvider({ children }: { children: ReactNode }) {
    const [mintedNfts, setMintedNfts] = useState<MintedNft[]>([]);

    const addMintedNft = (nft: MintedNft) => {
        setMintedNfts((prev) => [nft, ...prev]);
    };

    const value = useMemo(() => ({ mintedNfts, addMintedNft }), [mintedNfts]);

    return <NftContext.Provider value={value}>{children}</NftContext.Provider>;
}

export function useNftContext() {
    const ctx = useContext(NftContext);
    if (!ctx) throw new Error('useNftContext must be used within NftProvider');
    return ctx;
}


