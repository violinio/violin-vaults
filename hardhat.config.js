require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require("hardhat-contract-sizer");
require("solidity-coverage");
require("dotenv").config();

const { PRIVATE_KEY, ETHERSCAN_APIKEY } = process.env;
/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  namedAccounts: {
    deployer: 0,
  },
  networks: {
    hardhat: {},
    poly: {
      url: "https://polygon-rpc.com/",
      accounts: [`0x${PRIVATE_KEY}`],
    },
    bsc: {
      url: "https://bsc-dataseed.binance.org/",
      accounts: [`0x${PRIVATE_KEY}`],
    },
    avax: {
      url: "https://api.avax.network/ext/bc/C/rpc",
      accounts: [`0x${PRIVATE_KEY}`],
    },
    fantom: {
      url: "https://rpc.ftm.tools/",
      accounts: [`0x${PRIVATE_KEY}`],
    },
    celo: {
      url: "https://forno.celo.org",
      accounts: [`0x${PRIVATE_KEY}`],
    },
    heco: {
      url: "https://http-mainnet-node.huobichain.com",
      accounts: [`0x${PRIVATE_KEY}`],
    },
    kcc: {
      url: "https://rpc-mainnet.kcc.network",
      accounts: [`0x${PRIVATE_KEY}`],
    },
    xdai: {
      url: "https://rpc.xdaichain.com/",
      accounts: [`0x${PRIVATE_KEY}`],
    },
    harmony: {
      url: "https://api.harmony.one",
      accounts: [`0x${PRIVATE_KEY}`],
    },
    moonriver: {
      url: "https://rpc.moonriver.moonbeam.network",
      accounts: [`0x${PRIVATE_KEY}`],
    },
    arbitrum: {
      url: "https://arb1.arbitrum.io/rpc",
      accounts: [`0x${PRIVATE_KEY}`],
    },
    // TESTNETS
    avax_fuji: {
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      accounts: [`0x${PRIVATE_KEY}`],
    },
    ftm_testnet: {
      url: "https://rpc.testnet.fantom.network/",
      accounts: [`0x${PRIVATE_KEY}`],
    },
    poly_mumbai: {
      url: "https://rpc-mumbai.maticvigil.com/",
      accounts: [`0x${PRIVATE_KEY}`],
    },
  },
  etherscan: {
    apiKey: `${ETHERSCAN_APIKEY}`,
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },
  deterministicDeployment: (chainId) =>  ({
     "factory": "0xdbfD940f57E63049039404c1b35b9e47e90F2B3e"
    })
  ,
};
