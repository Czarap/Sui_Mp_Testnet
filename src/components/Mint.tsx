import { useCurrentAccount,
    useSignAndExecuteTransaction,
    useSuiClient,
} from '@mysten/dapp-kit';
import { Transaction } from "@mysten/sui/transactions";
import { CONTRACTMODULEMETHOD, CONTRACTMODULENAME, CONTRACTPACKAGEID } from '../configs/constants';
import { useState } from 'react';
import NFTCard from './NFTCard';
import { useNftContext } from '../context/NftContext';

const Minter = () => {
    const suiClient = useSuiClient();
    const account = useCurrentAccount();
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [url, setUrl] = useState('');
    const [isMinting, setIsMinting] = useState(false);
    const [mintedNftId, setMintedNftId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const { addMintedNft } = useNftContext();

    const mintNFT = () => {
        if (!account) {
            return;
        }

        setErrorMessage(null);
        setIsMinting(true);
        setMintedNftId(null);

        const txb = new Transaction();
        const contractAddress = CONTRACTPACKAGEID;
        const contractModuleName = CONTRACTMODULENAME;
        const contractMethod = CONTRACTMODULEMETHOD;

        // Basic config validation to avoid invalid target errors
        const isHex = (v: string) => /^0x[0-9a-fA-F]+$/.test(v);
        const isIdent = (v: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(v);
        if (!contractAddress || !isHex(contractAddress)) {
            setIsMinting(false);
            setErrorMessage('Invalid CONTRACTPACKAGEID. Please set a valid 0x… package id in src/configs/constants.ts');
            return;
        }
        if (!contractModuleName || !isIdent(contractModuleName)) {
            setIsMinting(false);
            setErrorMessage('Missing CONTRACTMODULENAME. Set your Move module name in src/configs/constants.ts');
            return;
        }
        if (!contractMethod || !isIdent(contractMethod)) {
            setIsMinting(false);
            setErrorMessage('Missing CONTRACTMODULEMETHOD. Set your entry function name in src/configs/constants.ts');
            return;
        }

        txb.moveCall({
            target: `${contractAddress}::${contractModuleName}::${contractMethod}`,
            arguments: [
                txb.pure.string(name),
                txb.pure.string(description),
                txb.pure.string(url)
            ],
        });

        signAndExecute(
            {
                transaction: txb as any,
            },
            {
                onSuccess: async ({ digest }) => {
                    try {
                        const { effects } = await suiClient.waitForTransaction({
                            digest: digest,
                            options: {
                                showEffects: true,
                            },
                        });

                        if (effects?.created?.[0]?.reference?.objectId) {
                            const objectId = effects.created[0].reference.objectId;
                            setMintedNftId(objectId);
                            addMintedNft({
                                objectId,
                                name: name || 'Untitled',
                                description: description || '',
                                imageUrl: url || 'https://picsum.photos/seed/preview/600/600',
                            });
                            setName('');
                            setDescription('');
                            setUrl('');
                        }
                    } finally {
                        setIsMinting(false);
                    }
                },
                onError: (e) => {
                    setIsMinting(false);
                    setErrorMessage(`Mint failed: ${String(e)}`);
                }
            },
        );
    };

    return (
        <div>
            {account ? (
                <div className="mint-card">
                    <div className="mint-form">
                        <label className="field">
                            <span className="label">Name</span>
                            <input
                                className="input"
                                type="text"
                                placeholder="e.g. Oceanic Dream"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={isMinting}
                            />
                        </label>
                        <label className="field">
                            <span className="label">Description</span>
                            <input
                                className="input"
                                type="text"
                                placeholder="A short description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                disabled={isMinting}
                            />
                        </label>
                        <label className="field">
                            <span className="label">Image URL</span>
                            <input
                                className="input"
                                type="text"
                                placeholder="https://... .png / .jpg"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                disabled={isMinting}
                            />
                        </label>
                        <button className="button primary full" onClick={mintNFT} disabled={isMinting}>
                            {isMinting ? 'Minting…' : 'Mint Your NFT'}
                        </button>
                    {errorMessage && (
                        <div className="success-message" style={{ borderColor: '#e53935', backgroundColor: 'rgba(229,57,53,0.15)', color: '#ffb3ae' }}>
                            {errorMessage}
                        </div>
                    )}
                        {mintedNftId && (
                            <div className="success-message">
                                <p>NFT Minted Successfully!</p>
                                <p>Object ID: {mintedNftId}</p>
                            </div>
                        )}
                    </div>
                    <div className="mint-preview">
                        {url && (
                            <NFTCard
                                imageUrl={url}
                                name={name || undefined}
                                description={description || undefined}
                            />
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default Minter;
