type CChainInfo = {
  id: '43113' | '43114';
  label: string;
  testnet: boolean;
  explorerTx: string;
};

const C_CHAINS: Record<CChainInfo['id'], CChainInfo> = {
  '43114': {
    id: '43114',
    label: 'Avalanche C-Chain',
    testnet: false,
    explorerTx: 'https://explorer.avax.network/c-chain/tx',
  },
  '43113': {
    id: '43113',
    label: 'Fuji C-Chain',
    testnet: true,
    explorerTx: 'https://explorer-test.avax.network/c-chain/tx',
  },
};

export function resolveCChain(chainId: string | undefined): CChainInfo {
  const selected = chainId?.trim() || '43113';
  if (selected !== '43113' && selected !== '43114') {
    throw new Error(`지원하지 않는 Avalanche 체인 ID입니다: ${selected}`);
  }
  return C_CHAINS[selected];
}

export const C_CHAIN = resolveCChain(process.env.NEXT_PUBLIC_CHAIN_ID);
export const C_CHAIN_EXPLORER_TX = C_CHAIN.explorerTx;
