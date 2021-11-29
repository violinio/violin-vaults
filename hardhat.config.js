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
    ftm: {
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
    cro: {
      url: "https://evm-cronos.crypto.org",
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
  deterministicDeployment: (chainId) => ({
    "factory": "0xdbfD940f57E63049039404c1b35b9e47e90F2B3e"
  })
  ,
};


const fs = require("fs")

function getSortedFiles(dependenciesGraph) {
  const tsort = require("tsort")
  const graph = tsort()

  const filesMap = {}
  const resolvedFiles = dependenciesGraph.getResolvedFiles()
  resolvedFiles.forEach((f) => (filesMap[f.sourceName] = f))

  for (const [from, deps] of dependenciesGraph.entries()) {
    for (const to of deps) {
      graph.add(to.sourceName, from.sourceName)
    }
  }

  const topologicalSortedNames = graph.sort()

  // If an entry has no dependency it won't be included in the graph, so we
  // add them and then dedup the array
  const withEntries = topologicalSortedNames.concat(resolvedFiles.map((f) => f.sourceName))

  const sortedNames = [...new Set(withEntries)]
  return sortedNames.map((n) => filesMap[n])
}

function getFileWithoutImports(resolvedFile) {
  const IMPORT_SOLIDITY_REGEX = /^\s*import(\s+)[\s\S]*?;\s*$/gm

  return resolvedFile.content.rawContent.replace(IMPORT_SOLIDITY_REGEX, "").trim()
}

subtask("flat:get-flattened-sources", "Returns all contracts and their dependencies flattened")
  .addOptionalParam("files", undefined, undefined, types.any)
  .addOptionalParam("output", undefined, undefined, types.string)
  .setAction(async ({ files, output }, { run }) => {
    const dependencyGraph = await run("flat:get-dependency-graph", { files })
    console.log(dependencyGraph)

    let flattened = ""

    if (dependencyGraph.getResolvedFiles().length === 0) {
      return flattened
    }

    const sortedFiles = getSortedFiles(dependencyGraph)

    let isFirst = true
    for (const file of sortedFiles) {
      if (!isFirst) {
        flattened += "\n"
      }
      flattened += `// File ${file.getVersionedName()}\n`
      flattened += `${getFileWithoutImports(file)}\n`

      isFirst = false
    }

    // Remove every line started with "// SPDX-License-Identifier:"
    flattened = flattened.replace(/SPDX-License-Identifier:/gm, "License-Identifier:")

    flattened = `// SPDX-License-Identifier: MIXED\n\n${flattened}`

    // Remove every line started with "pragma experimental ABIEncoderV2;" except the first one
    flattened = flattened.replace(/pragma experimental ABIEncoderV2;\n/gm, ((i) => (m) => (!i++ ? m : ""))(0))

    flattened = flattened.trim()
    if (output) {
      console.log("Writing to", output)
      fs.writeFileSync(output, flattened)
      return ""
    }
    return flattened
  })

subtask("flat:get-dependency-graph")
  .addOptionalParam("files", undefined, undefined, types.any)
  .setAction(async ({ files }, { run }) => {
    const sourcePaths = files === undefined ? await run("compile:solidity:get-source-paths") : files.map((f) => fs.realpathSync(f))

    const sourceNames = await run("compile:solidity:get-source-names", {
      sourcePaths,
    })

    const dependencyGraph = await run("compile:solidity:get-dependency-graph", { sourceNames })

    return dependencyGraph
  })

task("flat", "Flattens and prints contracts and their dependencies")
  .addOptionalVariadicPositionalParam("files", "The files to flatten", undefined, types.inputFile)
  .addOptionalParam("output", "Specify the output file", undefined, types.string)
  .setAction(async ({ files, output }, { run }) => {
    console.log(
      await run("flat:get-flattened-sources", {
        files,
        output,
      })
    )
  })