import { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { ADMIN_ADDRESS, CONTRACTPACKAGEID, MARKETPLACE_ID, MARKETPLACE_MODULE, WITHDRAW_METHOD } from '../configs/constants';

function AdminPanel() {
    const account = useCurrentAccount();
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();
    const suiClient = useSuiClient();
    const [amountSui, setAmountSui] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [feePercentBps] = useState<number>(200); // 2% default per your spec
    const [feeBalanceSui, setFeeBalanceSui] = useState<number>(0);

    const isAdmin = !!account && ADMIN_ADDRESS && account.address.toLowerCase() === ADMIN_ADDRESS.toLowerCase();

    const onWithdraw = async () => {
        setMessage(null);
        if (!isAdmin || !account) {
            setMessage('Not authorized.');
            return;
        }
        if (!CONTRACTPACKAGEID || !MARKETPLACE_ID || !MARKETPLACE_MODULE || !WITHDRAW_METHOD) {
            setMessage('Contract configuration incomplete.');
            return;
        }
        const parsed = Number(amountSui);
        if (!isFinite(parsed) || parsed <= 0) {
            setMessage('Enter a valid amount in SUI.');
            return;
        }
        const amountMist = BigInt(Math.floor(parsed * 1_000_000_000));

        setIsSubmitting(true);
        try {
            const txb = new Transaction();
            // Call: package::module::withdraw_method(shared_marketplace, amount)
            txb.moveCall({
                target: `${CONTRACTPACKAGEID}::${MARKETPLACE_MODULE}::${WITHDRAW_METHOD}`,
                arguments: [
                    txb.object(MARKETPLACE_ID),
                    txb.pure.u64(amountMist),
                ],
            });

            await new Promise<void>((resolve, reject) => {
                signAndExecute(
                    { transaction: txb },
                    {
                        onSuccess: async ({ digest }) => {
                            await suiClient.waitForTransaction({ digest });
                            setMessage('Withdrawal submitted successfully.');
                            setAmountSui('');
                            resolve();
                        },
                        onError: (e) => {
                            setMessage(`Error: ${String(e)}`);
                            reject(e);
                        },
                    },
                );
            });
        } catch (e) {
            // message is set above
        } finally {
            setIsSubmitting(false);
        }
    };

    // Load accumulated fees periodically
    if (MARKETPLACE_ID) {
        suiClient.getObject({ id: MARKETPLACE_ID, options: { showContent: true } }).then((obj) => {
            const data: any = (obj as any).data;
            const fields: any = data?.content?.dataType === 'moveObject' ? (data.content as any).fields : undefined;
            // Try common field names
            const mist = BigInt((fields?.balance?.value ?? fields?.fees?.value ?? 0) as any);
            setFeeBalanceSui(Number(mist) / 1_000_000_000);
        }).catch(() => {
            // ignore
        });
    }

    if (!isAdmin) return null;

    return (
        <section className="section">
            <div className="container">
                <div className="section-head">
                    <h2>Admin</h2>
                    <p className="muted">Marketplace fee: {(feePercentBps/100).toFixed(2)}% • Accumulated fees: {feeBalanceSui.toFixed(3)} SUI</p>
                </div>
                <div className="mint-card" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="mint-form">
                        <div className="muted">Marketplace ID: {MARKETPLACE_ID}</div>
                        <label className="field">
                            <span className="label">Amount (SUI)</span>
                            <input
                                className="input"
                                type="number"
                                min="0"
                                step="0.000000001"
                                placeholder="e.g. 0.5"
                                value={amountSui}
                                onChange={(e) => setAmountSui(e.target.value)}
                                disabled={isSubmitting}
                            />
                        </label>
                        <button className="button primary" onClick={onWithdraw} disabled={isSubmitting}>
                            {isSubmitting ? 'Withdrawing…' : 'Withdraw SUI'}
                        </button>
                        {message && <div className="success-message" style={{ marginTop: 12 }}>{message}</div>}
                    </div>
                </div>
            </div>
        </section>
    );
}

export default AdminPanel;


