const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

describe("VaultChef testing", function () {
  var VaultChef;
  var MockStrategy;
  var TestToken;
  const startBalUser1 = ethers.utils.parseEther("100.0");

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  beforeEach("Should deploy contracts", async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const TestTokenFactory = await ethers.getContractFactory("TestToken", owner);
    const MockStrategyFactory = await ethers.getContractFactory("SimpleMockStrategy", owner);
    const VaultChefFactory = await ethers.getContractFactory("VaultChef", owner);
    TestToken = await TestTokenFactory.deploy("TestToken", "TST");
    await TestToken.connect(owner).transfer(user1.address, startBalUser1);
    VaultChef = await VaultChefFactory.deploy();
    MockStrategy = await MockStrategyFactory.deploy(VaultChef.address, TestToken.address);
    await TestToken.connect(owner).approve(MockStrategy.address, ethers.utils.parseEther("100.0"));

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

  it("It should allow ownership transfer", async function () {
    expect(await VaultChef.owner()).to.be.equals(owner.address);
    expect(await VaultChef.connect(owner).setPendingOwner(user1.address))
      .to.emit(VaultChef, "PendingOwnershipTransferred")
      .withArgs(ZERO_ADDRESS, user1.address);
    expect(await VaultChef.owner()).to.be.equals(owner.address);
    expect(await VaultChef.pendingOwner()).to.be.equals(user1.address);

    await expect(VaultChef.connect(owner).transferOwnership())
      .to.be.revertedWith("Ownable: caller is not the pendingOwner");

    expect(await VaultChef.connect(user1).transferOwnership())
      .to.emit(VaultChef, "OwnershipTransferred")
      .withArgs(owner.address, user1.address);

    expect(await VaultChef.owner()).to.be.equals(user1.address);
  });

  it("It should allow ownership renouncing", async function () {
    expect(await VaultChef.connect(owner).renounceOwnership())
      .to.emit(VaultChef, "OwnershipTransferred")
      .withArgs(owner.address, ZERO_ADDRESS);

    expect(await VaultChef.owner()).to.be.equals(ZERO_ADDRESS);
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
    await expect(VaultChef.connect(user1).addVault(MockStrategy.address, 0))
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

  it("It should revert operations on nonexistent vault", async function () {
    await expect(VaultChef.connect(owner).pauseVault(0, true))
      .to.revertedWith("!no vault");
    await expect(VaultChef.poolInfo(0))
      .to.be.revertedWith("!no vault");

    await expect(VaultChef.totalUnderlying(0))
      .to.be.revertedWith("!no vault");

    await expect(VaultChef.userInfo(0, user1.address))
      .to.be.revertedWith("!no vault");
  });

  it("It should have dummy masterchef startBlock function", async function () {
    expect(await VaultChef.startBlock()).to.be.equals(0);
  });

  it("It should have zero allocPoints", async function () {
    expect(await VaultChef.totalAllocPoint()).to.be.equals(0);
  });

  describe("With first mock vault (5% fee)", function () {
    this.beforeEach("Should add vault", async function () {
      expect(await VaultChef.connect(owner).addVault(MockStrategy.address, 500))
        .to.emit(VaultChef, "VaultAdded")
        .withArgs(0, MockStrategy.address, 500);
    });

    it("It should not allow adding the strategy twice ", async function () {
      await expect(VaultChef.connect(owner).addVault(MockStrategy.address, 500))
        .to.be.revertedWith("!exists");
    });

    it("User should not be able to call vault governance functions", async function () {
      await expect(VaultChef.connect(user1).setVault(0, 100))
        .to.be.revertedWith("Ownable: caller is not the owner");
      await expect(VaultChef.connect(user1).pauseVault(0, true))
        .to.be.revertedWith("Ownable: caller is not the owner");
      await expect(VaultChef.connect(user1).panicVault(0))
        .to.be.revertedWith("Ownable: caller is not the owner");
      await expect(VaultChef.connect(user1).panicVault(0))
        .to.be.revertedWith("Ownable: caller is not the owner");
      await expect(VaultChef.connect(user1).inCaseVaultTokensGetStuck(0, TestToken.address, user1.address, 100))
        .to.be.revertedWith("Ownable: caller is not the owner");
      await expect(VaultChef.connect(user1).renounceOwnership())
        .to.be.revertedWith("Ownable: caller is not the owner");
      await expect(VaultChef.connect(user1).setPendingOwner(user2.address))
        .to.be.revertedWith("Ownable: caller is not the owner");
      await expect(VaultChef.connect(user1).transferOwnership())
        .to.be.revertedWith("Ownable: caller is not the pendingOwner");
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
      const vault = await VaultChef.vaultInfo(0);
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

    it("It should revert deposits without approval", async function () {
      await expect(VaultChef.connect(user1).deposit(0, ethers.utils.parseEther("1.0")))
        .to.be.revertedWith("ERC20: transfer amount exceeds allowance");
      await expect(VaultChef.connect(user1).depositUnderlying(0, ethers.utils.parseEther("1.0"), false, 0))
        .to.be.revertedWith("ERC20: transfer amount exceeds allowance");
    });

    it("It should revert pulled deposits from eoa", async function () {
      await expect(VaultChef.connect(user1).depositUnderlying(0, ethers.utils.parseEther("1.0"), true, 0))
        .to.be.reverted;
    });

    describe("With 2 ether token approval [user1]", function () {
      this.beforeEach("Approve VaultChef", async function () {
        await TestToken.connect(user1).approve(VaultChef.address, ethers.utils.parseEther("2.0"));
      });

      it("With deposits and withdraws failing on nonexistent vaults [user1]", async function () {
        await expect(VaultChef.connect(user1).depositUnderlying(1, ethers.utils.parseEther("1.0"), false, 0))
          .to.be.revertedWith("!no vault");
        await expect(VaultChef.connect(user1).deposit(1, ethers.utils.parseEther("1.0")))
          .to.be.revertedWith("!no vault");
        await expect(VaultChef.connect(user1).withdraw(1, ethers.utils.parseEther("1.0")))
          .to.be.revertedWith("!no vault");
        await expect(VaultChef.connect(user1).withdrawShares(1, ethers.utils.parseEther("1.0"), 0))
          .to.be.revertedWith("!no vault");
        await expect(VaultChef.connect(user1).emergencyWithdraw(1))
          .to.be.revertedWith("!no vault");
      });

      describe("With 1 ether MC-based deposit [user1]", function () {
        const deposit1amount = ethers.utils.parseEther("1.0");
        this.beforeEach("Deposit 1 ether", async function () {
          await expect(VaultChef.connect(user1).deposit(0, deposit1amount))
            .to.emit(VaultChef, "Deposit")
            .withArgs(0, user1.address, deposit1amount, deposit1amount); // vaultId, user, shares, underlying
        });
        it("It should have deducted 1 ether from sender", async function () {
          expect(await TestToken.balanceOf(user1.address)).to.be.equal(startBalUser1.sub(ethers.utils.parseEther("1.0")));
        });
        it("It should not allow foreign withdrawals [user2]", async function () {
          await expect(VaultChef.connect(user2).withdraw(0, deposit1amount))
            .to.be.revertedWith("!insufficient shares");
        });

        it("It should have updated userInfo", async function () {
          const userInfo = await VaultChef.userInfo(0, user1.address);
          expect(userInfo[0]).to.be.equal(deposit1amount);
          expect(userInfo[1]).to.be.equal(0);
        });

        it("It should have updated vault balance, total supply and totalUnderlying", async function () {
          expect(await VaultChef.balanceOf(user1.address, 0)).to.be.equal(deposit1amount);
          expect(await VaultChef.totalSupply(0)).to.be.equal(deposit1amount);
          expect(await VaultChef.totalUnderlying(0)).to.be.equal(deposit1amount);
        });

        it("It should allow withdrawShares", async function () {
          await expect(VaultChef.connect(user1).withdrawShares(0, deposit1amount, 0))
            .to.emit(VaultChef, "Withdraw")
            .withArgs(0, user1.address, user1.address, deposit1amount, deposit1amount); // vaultId, user, shares, underlying
          expect(await VaultChef.balanceOf(user1.address, 0)).to.be.equal(0);
          expect(await VaultChef.totalSupply(0)).to.be.equal(0);
          expect(await VaultChef.totalUnderlying(0)).to.be.equal(0);
          expect(await TestToken.balanceOf(user1.address)).to.be.equal(startBalUser1);
        });

        it("It should allow emergencyWithdraw", async function () {
          await expect(VaultChef.connect(user1).emergencyWithdraw(0))
            .to.emit(VaultChef, "Withdraw")
            .withArgs(0, user1.address, user1.address, deposit1amount, deposit1amount); // vaultId, user, shares, underlying
          expect(await VaultChef.balanceOf(user1.address, 0)).to.be.equal(0);
          expect(await VaultChef.totalSupply(0)).to.be.equal(0);
          expect(await VaultChef.totalUnderlying(0)).to.be.equal(0);
          expect(await TestToken.balanceOf(user1.address)).to.be.equal(startBalUser1);
        });

        describe("With 1 ether MC-based withdrawal [user1]", function () {
          this.beforeEach("Withdraw 1 ether", async function () {
            await expect(VaultChef.connect(user1).withdraw(0, deposit1amount))
              .to.emit(VaultChef, "Withdraw")
              .withArgs(0, user1.address, user1.address, deposit1amount, deposit1amount); // vaultId, user, shares, underlying
          });

          it("It should have sent tokens to the user", async function () {
            const userInfo = await VaultChef.userInfo(0, user1.address);
            expect(await TestToken.balanceOf(user1.address)).to.be.equal(startBalUser1);
            expect(userInfo[1]).to.be.equal(0);
          });

          it("It should have updated userInfo", async function () {
            const userInfo = await VaultChef.userInfo(0, user1.address);
            expect(userInfo[0]).to.be.equal(0);
            expect(userInfo[1]).to.be.equal(0);
          });

          it("It should have updated vault balance, total supply and totalUnderlying", async function () {
            expect(await VaultChef.balanceOf(user1.address, 0)).to.be.equal(0);
            expect(await VaultChef.totalSupply(0)).to.be.equal(0);
            expect(await VaultChef.totalUnderlying(0)).to.be.equal(0);
          });
        });

        describe("With pause vault", function () {
          this.beforeEach("Should pause vault", async function () {
            expect(await VaultChef.connect(owner).pauseVault(0, true))
              .to.emit(VaultChef, "VaultPaused")
              .withArgs(0, true);
          });

          it("It should be marked as paused", async function () {
            const vault = await VaultChef.vaultInfo(0);
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
            const vault = await VaultChef.vaultInfo(0);
            expect(vault[2]).to.be.equals(false); // paused
          });

          it("It should not allow deposits", async function () {
            await expect(VaultChef.connect(user1).deposit(0, deposit1amount))
              .to.be.revertedWith("!paused");
            await expect(VaultChef.connect(user1).depositUnderlying(0, deposit1amount, false, 0))
              .to.be.revertedWith("!paused");
          });

          it("It should allow withdrawals", async function () {
            await expect(VaultChef.connect(user1).withdraw(0, deposit1amount))
              .to.emit(VaultChef, "Withdraw")
              .withArgs(0, user1.address, user1.address, deposit1amount, deposit1amount); // vaultId, user, shares, underlying
            expect(await VaultChef.balanceOf(user1.address, 0)).to.be.equal(0);
            expect(await VaultChef.totalSupply(0)).to.be.equal(0);
            expect(await VaultChef.totalUnderlying(0)).to.be.equal(0);
          });

          it("It should allow withdrawShares", async function () {
            await expect(VaultChef.connect(user1).withdrawShares(0, deposit1amount, 0))
              .to.emit(VaultChef, "Withdraw")
              .withArgs(0, user1.address, user1.address, deposit1amount, deposit1amount); // vaultId, user, shares, underlying
            expect(await VaultChef.balanceOf(user1.address, 0)).to.be.equal(0);
            expect(await VaultChef.totalSupply(0)).to.be.equal(0);
            expect(await VaultChef.totalUnderlying(0)).to.be.equal(0);
          });

          it("It should allow emergencyWithdraw", async function () {
            await expect(VaultChef.connect(user1).emergencyWithdraw(0))
              .to.emit(VaultChef, "Withdraw")
              .withArgs(0, user1.address, user1.address, deposit1amount, deposit1amount); // vaultId, user, shares, underlying
            expect(await VaultChef.balanceOf(user1.address, 0)).to.be.equal(0);
            expect(await VaultChef.totalSupply(0)).to.be.equal(0);
            expect(await VaultChef.totalUnderlying(0)).to.be.equal(0);
          });

          it("It should allow panicking", async function () {
            await expect(VaultChef.connect(owner).panicVault(0))
              .to.emit(VaultChef, "VaultPanicked")
              .withArgs(0); // vaultId, user, shares, underlying

            const timestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
            const vault = await VaultChef.vaultInfo(0);
            expect(vault[2]).to.be.equals(true); // paused
            expect(vault[3]).to.be.equals(true); // panicked
            expect(vault[4]).to.be.equal(timestamp);
          });

          it("It should allow share safeTransferFrom", async function () {
            await expect(VaultChef.connect(user1).safeTransferFrom(user1.address, user2.address, 0, 1000, []))
              .to.emit(VaultChef, "TransferSingle")
              .withArgs(user1.address, user1.address, user2.address, 0, 1000); // vaultId, user, shares, underlying

            expect(await VaultChef.balanceOf(user1.address, 0)).to.be.equal(deposit1amount.sub(1000));
            expect(await VaultChef.balanceOf(user2.address, 0)).to.be.equal(1000);
          });

          it("It should allow share safeBatchTransferFrom", async function () {
            await expect(VaultChef.connect(user1).safeBatchTransferFrom(user1.address, user2.address, [0], [1000], []))
              .to.emit(VaultChef, "TransferBatch")
              .withArgs(user1.address, user1.address, user2.address, [0], [1000]); // vaultId, user, shares, underlying

            expect(await VaultChef.balanceOf(user1.address, 0)).to.be.equal(deposit1amount.sub(1000));
            expect(await VaultChef.balanceOf(user2.address, 0)).to.be.equal(1000);
          });
        });

        describe("With 0.1 ether harvest increment", function () {
          const harvest1amount = ethers.utils.parseEther("0.1");
          const vaultSharesToOwner = BigNumber.from("4545454545454545");
          this.beforeEach("Harvest 0.1 ether", async function () {
            await MockStrategy.connect(user1).setNextHarvest(harvest1amount);
            await expect(VaultChef.connect(owner).harvest(0))
              .to.emit(VaultChef, "VaultHarvest")
              .withArgs(0, harvest1amount);
          });

          it("It should have updated vault balance, total supply and totalUnderlying", async function () {
            expect(await VaultChef.balanceOf(user1.address, 0)).to.be.equal(deposit1amount);
            expect(await VaultChef.balanceOf(owner.address, 0)).to.be.equal(vaultSharesToOwner);
            expect(await VaultChef.totalSupply(0)).to.be.equal(deposit1amount.add(vaultSharesToOwner));
            expect(await VaultChef.totalUnderlying(0)).to.be.equal(deposit1amount.add(harvest1amount));
          });

          it("It should have updated userInfo", async function () {
            const userInfo = await VaultChef.userInfo(0, user1.address);
            expect(userInfo[0]).to.be.equal(BigNumber.from("1095022624434389140"));
            expect(userInfo[1]).to.be.equal(0);
            const ownerInfo = await VaultChef.userInfo(0, owner.address);
            expect(ownerInfo[0]).to.be.equal(BigNumber.from("4977375565610859"));
            expect(ownerInfo[1]).to.be.equal(0);

            expect(ownerInfo[0].add(userInfo[0])).to.be.below(deposit1amount.add(harvest1amount));
            expect(ownerInfo[0].add(userInfo[0])).to.be.closeTo(deposit1amount.add(harvest1amount), 10);
          });

          it("It should have valid harvest timestamp", async function () {
            const timestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
            expect((await VaultChef.vaultInfo(0))[5]).to.be.equal(timestamp);
          });
        });
      });
    });

  });
});
