const { NonceManager } = require("@ethersproject/experimental");

const delay = ms => new Promise(res => setTimeout(res, ms));
const etherscanChains = ["poly", "bsc", "poly_mumbai", "ftm", "arbitrum"];
const sourcifyChains = ["xdai", "celo", "avax", "avax_fuji", "arbitrum", "cro"];

const main = async function (hre) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const managedDeployer = new NonceManager(deployer);
    const signer = await hre.ethers.getSigner(deployer);

    // We get the contract to deploy
    const vaultchef = await deploy("WhitelistedVaultChef", { 
        from: managedDeployer.signer, 
        log: true, 
        args: [deployer], 
        deterministicDeployment: "0x9c22ff5f21f0b81b113e63f7db6da94fedef11b2119b4088b89664fb9a3cb658" });
    console.log("VaultChef deployed to:", vaultchef.address);

    const governor = await deploy("VaultChefGovernor", { from: managedDeployer.signer, log: true, args: [vaultchef.address, signer.address], 
        deterministicDeployment: "0x9c22ff5f21f0b81b113e63f7db6da94fedef11b2119b4088b89664fb9a3cb657" });
    console.log("VaultChefGovernor deployed to:", governor.address);

    const vaultchefContractFactory = await ethers.getContractFactory("WhitelistedVaultChef");
    const vaultchefContract = await vaultchefContractFactory.attach(vaultchef.address);
    const governorContractFactory = await ethers.getContractFactory("VaultChefGovernor");
    const governorContract = await governorContractFactory.attach(governor.address);
    if((await vaultchefContract.owner()) !== governor.address) {
        await vaultchefContract.connect(signer).setPendingOwner(governor.address);
        await delay(5000);
        await governorContract.connect(signer).transferOwnership();
        console.log("VaultChefGovernor ownership claimed");
    }


    const chain = hre.network.name;
    try {
        await verify(hre, chain, vaultchef.address, [signer.address]);
    }catch(error) {
        console.log(error);
    }
    try {
        await verify(hre, chain, governor.address, [vaultchef.address, signer.address]);
    }catch(error) {
        console.log(error);
    }
}

async function verify(hre, chain, contract, args) {
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
            constructorArguments: args
        });
    } else if (isSourcify) {
        try {
            await hre.run("sourcify", {
                address: contract,
                network: chain,
                constructorArguments: args
            });
        } catch (error) {
            console.log("verification failed: sourcify not supported?");
        }
    }
}

module.exports = main;