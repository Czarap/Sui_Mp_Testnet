export const DEMO_MODE = false;
export const NETWORK = 'testnet';

export const CONTRACT_CONFIG = {
  PACKAGE_ID:
    '0xdd0420d1074522b8121f656058dcaf31ed7464551400ff83b87e11fa6a882dca',
  NFT_MODULE: 'nft',
  MARKETPLACE_MODULE: 'marketplace',
  FUNCTIONS: {
    MINT: 'mint_nft',
    LIST: 'list_nft',
    BUY: 'buy_nft',
    CANCEL_LISTING: 'cancel_listing',
    WITHDRAW_FEES: 'withdraw_fees',
  },
  TYPES: {
    NFT: `PACKAGE_ID::nft::NFT`,
    LISTING: `PACKAGE_ID::marketplace::Listing`,
    MARKETPLACE: `PACKAGE_ID::marketplace::Marketplace`,
  },
  ADMIN_ADDRESS:
    '0xaaf18cde7fee39af70225e997c5ac1b533a574f75746f717e72be9b317b8d7f7',
  MARKETPLACE_ID:
    '0x82be626e2e767172a8086bf0911c7172f0ff33bcf5eb960d517873e1f323f20a',
};

export function getType(typeKey: keyof typeof CONTRACT_CONFIG.TYPES): string {
  return CONTRACT_CONFIG.TYPES[typeKey].replace(
    'PACKAGE_ID',
    CONTRACT_CONFIG.PACKAGE_ID,
  );
}

export function getFunctionId(
  functionKey: keyof typeof CONTRACT_CONFIG.FUNCTIONS,
): string {
  const moduleName = functionKey.includes('MINT')
    ? CONTRACT_CONFIG.NFT_MODULE
    : CONTRACT_CONFIG.MARKETPLACE_MODULE;
  return `${CONTRACT_CONFIG.PACKAGE_ID}::${moduleName}::${CONTRACT_CONFIG.FUNCTIONS[functionKey]}`;
}


