const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

describe("VaultChef testing", function () {
  var VaultChef;
  var MockStrategy;
  var TestToken;

  beforeEach("Should deploy contracts", async function () {
    [owner, user1] = await ethers.getSigners();
    const TestTokenFactory = await ethers.getContractFactory("TestToken", owner);
    const MockStrategyFactory = await ethers.getContractFactory("SimpleMockStrategy", owner);
    const VaultChefFactory = await ethers.getContractFactory("VaultChef", owner);
    TestToken = await TestTokenFactory.deploy("TestToken", "TST");
    VaultChef = await VaultChefFactory.deploy();
    MockStrategy = await MockStrategyFactory.deploy(VaultChef.address, TestToken.address);

    //TestToken should approve the locker to send funds
    //await TestToken.approve(Locker.address, 100000000);
    //await TestToken.connect(owner).transfer(walletWithdraw.address, 1000000);

    expect(await VaultChef.address).to.not.undefined;
    expect(await MockStrategy.address).to.not.undefined;
    expect(await TestToken.address).to.not.undefined;
  });

  it("validVault should be false while no vault is added", async function () {
    expect(await VaultChef.isValidVault(0)).to.be.equals(false);
    expect(await VaultChef.isValidVault(1)).to.be.equals(false);
    expect(await VaultChef.isValidVault(2)).to.be.equals(false);
  });

  it("It should have ERC-20 metadata", async function () {
    expect(await VaultChef.name()).to.be.equals("Violin Vault Receipt");
    expect(await VaultChef.symbol()).to.be.equals("vVault");
    expect(await VaultChef.decimals()).to.be.equals(18);
  });

  it("It should allow ERC-20 metadata changing", async function () {
    const newName = "test123";
    const newSymbol = "TEST_SYMB";
    const newDecimals = 8;
    expect(await VaultChef.connect(owner).changeMetadata(newName, newSymbol, newDecimals))
      .to.emit(VaultChef, "ChangeMetadata")
      .withArgs(newName, newSymbol, newDecimals);

    expect(await VaultChef.name()).to.be.equals(newName);
    expect(await VaultChef.symbol()).to.be.equals(newSymbol);
    expect(await VaultChef.decimals()).to.be.equals(newDecimals);
  });

  it("User should not be able to call governance functions", async function () {
    await expect(VaultChef.connect(user1).addVault(MockStrategy.address))
      .to.be.revertedWith("Ownable: caller is not the owner");
    await expect(VaultChef.connect(user1).setURI("test"))
      .to.be.revertedWith("Ownable: caller is not the owner");
    await expect(VaultChef.connect(user1).changeMetadata("testName", "testSymb", 8))
      .to.be.revertedWith("Ownable: caller is not the owner");
    await expect(VaultChef.connect(user1).inCaseTokensGetStuck(TestToken.address, user1.address))
      .to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("It should have poolLength zero", async function () {
    expect(await VaultChef.poolLength()).to.be.equals(0);
  });

  it("It should revert if nonexistend vault is paused", async function () {
    await expect(VaultChef.connect(owner).pauseVault(0, true))
      .to.revertedWith("!no vault");
  });
  
  it("It should have dummy masterchef startBlock function", async function () {
    expect(await VaultChef.startBlock()).to.be.equals(0);
  });

  it("It should have zero allocPoints", async function () {
    expect(await VaultChef.totalAllocPoint()).to.be.equals(0);
  });

  describe("With first mock vault", function () {
    this.beforeEach("Should add vault", async function () {
      expect(await VaultChef.connect(owner).addVault(MockStrategy.address))
        .to.emit(VaultChef, "VaultAdded")
        .withArgs(MockStrategy.address);
    });

    it("User should not be able to call vault governance functions", async function () {
      await expect(VaultChef.connect(user1).pauseVault(0, true))
        .to.be.revertedWith("Ownable: caller is not the owner");
      await expect(VaultChef.connect(user1).panicVault(0))
        .to.be.revertedWith("Ownable: caller is not the owner");
      await expect(VaultChef.connect(user1).panicVault(0))
        .to.be.revertedWith("Ownable: caller is not the owner");
      await expect(VaultChef.connect(user1).inCaseVaultTokensGetStuck(0, TestToken.address, user1.address, 100))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("It should have and allow for changing metadata URI", async function () {
      const oldURI = "https://violin.finance/api/vaults/{id}.json";
      expect(await VaultChef.uri(0)).to.be.equals(oldURI);
      const newURI = "https://violin.finance/api/bsc/vaults/{id}.json";
      expect(await VaultChef.connect(owner).setURI(newURI))
        .to.emit(VaultChef, "URIUpdated")
        .withArgs(oldURI, newURI);
      expect(await VaultChef.uri(0)).to.be.equals(newURI);
    });

    it("isValidVault should return true for the zero index", async function () {
      expect(await VaultChef.isValidVault(0)).to.be.equals(true);
      expect(await VaultChef.isValidVault(1)).to.be.equals(false);
    });

    it("It should have poolLength one", async function () {
      expect(await VaultChef.poolLength()).to.be.equals(1);
    });

    it("It should have one allocPoints", async function () {
      expect(await VaultChef.totalAllocPoint()).to.be.equals(1);
    });

    it("It should have correct first vault info", async function () {
      const vault = await VaultChef.vaults(0);
      expect(vault[0]).to.be.equals(TestToken.address); // underlying
      expect(vault[1]).to.be.equals(MockStrategy.address); // strategy
      expect(vault[2]).to.be.equals(false); // paused
      expect(vault[3]).to.be.equals(false); // panicked
      expect(vault[4]).to.be.equals(0); // panickTimestamp
    });

    it("It should have zero stake and supply", async function () {
      expect(await VaultChef.balanceOf(user1.address, 0)).to.be.equals(0);
      expect(await VaultChef.totalSupply(0)).to.be.equals(0);
    });

    it("It should have correct initial userInfo and poolInfo", async function () {
      const poolInfo = await VaultChef.poolInfo(0);
      expect(poolInfo[0]).to.be.equals(TestToken.address); // lpToken
      expect(poolInfo[1]).to.be.equals(1); // allocPoint
      expect(poolInfo[2]).to.be.equals(0); // lastRewardBlock
      expect(poolInfo[3]).to.be.equals(0); // accPerShare
      const userInfo = await VaultChef.userInfo(0, user1.address);
      expect(userInfo[0]).to.be.equals(0); // amount
      expect(userInfo[1]).to.be.equals(0); // rewardDebt
    });

    describe("With pause vault", function () {
      this.beforeEach("Should pause vault", async function () {
        expect(await VaultChef.connect(owner).pauseVault(0, true))
          .to.emit(VaultChef, "VaultPaused")
          .withArgs(0, true);
      });

      it("It should be marked as paused", async function () {
        const vault = await VaultChef.vaults(0);
        expect(vault[2]).to.be.equals(true); // paused
      });

      it("It should not be pausable again", async function () {
        await expect(VaultChef.connect(owner).pauseVault(0, true))
          .to.be.revertedWith("!set");
      });


      it("It should be unpausable", async function () {
        expect(await VaultChef.connect(owner).pauseVault(0, false))
          .to.emit(VaultChef, "VaultPaused")
          .withArgs(0, false);
        const vault = await VaultChef.vaults(0);
        expect(vault[2]).to.be.equals(false); // paused
      });
    });
  });
});
