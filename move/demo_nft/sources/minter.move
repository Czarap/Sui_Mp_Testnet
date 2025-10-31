module demo_nft::minter {
    use std::string::String;
    use sui::object;
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;

    /// A very simple NFT type with metadata.
    struct Nft has key {
        id: object::UID,
        name: String,
        description: String,
        url: String,
    }

    /// Mint an NFT to the transaction sender with simple string metadata.
    public entry fun mint(name: String, description: String, url: String, ctx: &mut TxContext) {
        let uid = object::new(ctx);
        let nft = Nft { id: uid, name, description, url };
        transfer::transfer(nft, tx_context::sender(ctx));
    }
}


