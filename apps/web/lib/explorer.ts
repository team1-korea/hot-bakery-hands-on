const EXPLORER_TX: Record<string, string> = {
  '43114': 'https://build.avax.network/explorer/c-chain/tx',
  '43113': 'https://build.avax.network/explorer/fuji-c-chain/tx',
};

const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID ?? '43113';

export const C_CHAIN_EXPLORER_TX = EXPLORER_TX[CHAIN_ID] ?? EXPLORER_TX['43113'];
