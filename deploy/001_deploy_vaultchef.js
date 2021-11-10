

const delay = ms => new Promise(res => setTimeout(res, ms));
const etherscanChains = ["poly", "bsc", "poly_mumbai", "ftm", "arbitrum"];
const sourcifyChains = ["xdai", "celo", "avax", "avax_fuji", "arbitrum"];

const main = async function (hre) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    // We get the contract to deploy
    const vaultchef = await deploy("WhitelistedVaultChef", { 
        from: deployer, 
        log: true, 
        args: [deployer], 
        deterministicDeployment: "0x9c22ff5f21f0b81b113e63f7db6da94fedef11b2119b4088b89664fb9a3cb658" });
    console.log("VaultChef deployed to:", vaultchef.address);

    const chain = hre.network.name;
    await verify(hre, chain, vaultchef.address, deployer);
}

async function verify(hre, chain, contract, owner) {
    const isEtherscanAPI = etherscanChains.includes(chain);
    const isSourcify = sourcifyChains.includes(chain);
    if (!isEtherscanAPI && !isSourcify)
        return;

    console.log('verifying...');
    await delay(10000);
    if (isEtherscanAPI) {
        await hre.run("verify:verify", {
            address: contract,
            network: chain,
            constructorArguments: [owner]
        });
    } else if (isSourcify) {
        try {
            await hre.run("sourcify", {
                address: contract,
                network: chain,
                constructorArguments: [owner]
            });
        } catch (error) {
            console.log("verification failed: sourcify not supported?");
        }
    }
}

module.exports = main;