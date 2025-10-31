module demo_nft::marketplace {
    use sui::object;
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::sui::SUI;
    use sui::coin::{Self, Coin};
    use sui::balance::{Self as balance, Balance};
    use std::option;
    use demo_nft::minter::Nft;

    /// Shared marketplace holding a balance of SUI collected as fees.
    struct Marketplace has key {
        id: object::UID,
        fees: Balance<SUI>,
        // Optionally store admin if you want on-chain auth logic (UI already checks admin).
        admin: option::Option<address>,
    }

    /// Listing for an NFT on the marketplace.
    struct Listing has key {
        id: object::UID,
        nft: Nft,
        price: u64, // in MIST
        seller: address,
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

    /// List an NFT for sale on the marketplace.
    public entry fun list_nft(nft: Nft, price: u64, ctx: &mut TxContext) {
        let uid = object::new(ctx);
        let seller = tx_context::sender(ctx);
        let listing = Listing { id: uid, nft, price, seller };
        transfer::share_object(listing);
    }

    /// Buy an NFT from the marketplace, charging a 2% fee.
    public entry fun buy_nft(marketplace: &mut Marketplace, listing: Listing, payment: Coin<SUI>, ctx: &mut TxContext) {
        let buyer = tx_context::sender(ctx);
        let Listing { id, nft, price, seller } = listing;

        // Ensure payment is exactly the price
        assert!(coin::value(&payment) == price, 0);

        // Calculate 2% fee (200 basis points)
        let fee = price / 50; // 2% = 200/10000 = 1/50
        let seller_amount = price - fee;

        // Split payment: fee to marketplace, rest to seller
        let fee_coin = coin::split(&mut payment, fee, ctx);
        balance::join(&mut marketplace.fees, fee_coin);

        // Transfer remaining payment to seller
        transfer::public_transfer(payment, seller);

        // Transfer NFT to buyer
        transfer::public_transfer(nft, buyer);

        // Delete the listing
        object::delete(id);
    }

    /// Cancel a listing and return the NFT to the seller.
    public entry fun cancel_listing(listing: Listing, ctx: &mut TxContext) {
        let Listing { id, nft, price: _, seller } = listing;
        assert!(tx_context::sender(ctx) == seller, 0);
        transfer::public_transfer(nft, seller);
        object::delete(id);
    }
}


