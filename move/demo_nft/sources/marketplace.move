module demo_nft::marketplace {
    use sui::object;
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::sui::SUI;
    use sui::coin::Coin;
    use sui::balance::{Self as balance, Balance};
    use std::option;

    /// Shared marketplace holding a balance of SUI collected as fees.
    struct Marketplace has key {
        id: object::UID,
        fees: Balance<SUI>,
        // Optionally store admin if you want on-chain auth logic (UI already checks admin).
        admin: option::Option<address>,
    }

    /// Create the shared marketplace object.
    public entry fun init(admin: option::Option<address>, ctx: &mut TxContext) {
        let uid = object::new(ctx);
        let zero = balance::zero<SUI>();
        let m = Marketplace { id: uid, fees: zero, admin };
        transfer::share_object(m);
    }

    /// Deposit SUI fees into the marketplace (anyone can deposit).
    public entry fun deposit(m: &mut Marketplace, c: Coin<SUI>) {
        balance::join(&mut m.fees, c);
    }

    /// Withdraw `amount` MIST of SUI from marketplace fees to the caller.
    /// UI enforces admin, but you can also enforce it here if desired.
    public entry fun withdraw_fees(m: &mut Marketplace, amount: u64, ctx: &mut TxContext) {
        let coin = balance::split(&mut m.fees, amount);
        transfer::public_transfer(coin, tx_context::sender(ctx));
    }
}


