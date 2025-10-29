import { useCurrentAccount,
    useSignAndExecuteTransaction,
    useSuiClient,
} from '@mysten/dapp-kit';
import { Transaction } from "@mysten/sui/transactions";
import { CONTRACTMODULEMETHOD, CONTRACTMODULENAME, CONTRACTPACKAGEID } from '../configs/constants';
import { useState } from 'react';

const Minter = () => {
    const suiClient = useSuiClient();
    const account = useCurrentAccount();
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [url, setUrl] = useState('');
    const [isMinting, setIsMinting] = useState(false);
    const [mintedNftId, setMintedNftId] = useState<string | null>(null);

    const mintNFT = () => {
        if (!account) {
            return;
        }

        setIsMinting(true);
        setMintedNftId(null);

        const txb = new Transaction();
        const contractAddress = CONTRACTPACKAGEID;
        const contractModuleName = CONTRACTMODULENAME;
        const contractMethod = CONTRACTMODULEMETHOD;

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
                transaction: txb,
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
                            setMintedNftId(effects.created[0].reference.objectId);
                            setName('');
                            setDescription('');
                            setUrl('');
                        }
                    } finally {
                        setIsMinting(false);
                    }
                },
                onError: () => {
                    setIsMinting(false);
                }
            },
        );
    };

    return (
        <div>
            {account ? (
                <div className="mint-form">
                    <input
                        className="mint-input"
                        type="text"
                        placeholder="Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isMinting}
                    />
                    <input
                        className="mint-input"
                        type="text"
                        placeholder="Description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={isMinting}
                    />
                    <input
                        className="mint-input"
                        type="text"
                        placeholder="URL"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        disabled={isMinting}
                    />
                    <button className="mint-button" onClick={mintNFT} disabled={isMinting}>
                        {isMinting ? 'Minting...' : 'Mint Your NFT'}
                    </button>
                    {mintedNftId && (
                        <div className="success-message">
                            <p>NFT Minted Successfully!</p>
                            <p>Object ID: {mintedNftId}</p>
                        </div>
                    )}
                </div>
            ) : (
                <p>Connect your wallet to mint an NFT.</p>
            )}
        </div>
    );
};

export default Minter;
