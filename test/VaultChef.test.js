const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

describe("VaultChef testing", function () {
  let VaultChef;
  let MockStrategy;
  let WFeeMockStrategy;
  let MockZap;
  let TestToken;
  let TestToken2;
  const startBalUser1 = ethers.utils.parseEther("100.0");

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  beforeEach("Should deploy contracts", async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const TestTokenFactory = await ethers.getContractFactory("TestToken", owner);
    const TestToken2Factory = await ethers.getContractFactory("TestToken2", owner);
    const MockStrategyFactory = await ethers.getContractFactory("SimpleMockStrategy", owner);
    const WFeeMockStrategyFactory = await ethers.getContractFactory("WithdrawFeeMockStrategy", owner);
    const MockZapFactory = await ethers.getContractFactory("MockZap", owner);
    const VaultChefFactory = await ethers.getContractFactory("WhitelistedVaultChef", user2);
    TestToken = await TestTokenFactory.deploy("TestToken", "TST");
    TestToken2 = await TestToken2Factory.deploy("TestToken2", "TST2");
    await TestToken.connect(owner).transfer(user1.address, startBalUser1);
    VaultChef = await VaultChefFactory.deploy(owner.address);
    MockStrategy = await MockStrategyFactory.deploy(VaultChef.address, TestToken.address);
    WFeeMockStrategy = await WFeeMockStrategyFactory.deploy(VaultChef.address, TestToken.address);
    MockZap = await MockZapFactory.deploy(VaultChef.address);
    await TestToken.connect(owner).approve(MockStrategy.address, ethers.utils.parseEther("100.0"));

    expect(await VaultChef.address).to.not.undefined;
    expect(await MockStrategy.address).to.not.undefined;
    expect(await TestToken.address).to.not.undefined;
  });


  it("It fails deposits and withdraws on non whitelisted user", async function () {
    await expect(VaultChef.connect(user1).depositUnderlying(1, ethers.utils.parseEther("1.0"), false, 0))
      .to.be.revertedWith("!not whitelisted");
    await expect(VaultChef.connect(user1).deposit(1, ethers.utils.parseEther("1.0")))
      .to.be.revertedWith("!not whitelisted");
    await expect(VaultChef.connect(user1).withdraw(1, ethers.utils.parseEther("1.0")))
      .to.be.revertedWith("!not whitelisted");
    await expect(VaultChef.connect(user1).withdrawShares(1, ethers.utils.parseEther("1.0"), 0))
      .to.be.revertedWith("!not whitelisted");
    await expect(VaultChef.connect(user1).withdrawSharesTo(1, ethers.utils.parseEther("1.0"), 0, user1.address))
      .to.be.revertedWith("!not whitelisted");
    await expect(VaultChef.connect(user1).harvest(1))
      .to.be.revertedWith("!not whitelisted");
    await expect(VaultChef.connect(user1).safeBatchTransferFrom(user1.address, user2.address, [], [], []))
      .to.be.revertedWith("!not whitelisted");
    await expect(VaultChef.connect(user1).safeTransferFrom(user1.address, user2.address, 0, 0, []))
      .to.be.revertedWith("!not whitelisted");
  });


  describe("With everyone whitelisted", function () {
    this.beforeEach("whitelist users", async function () {
      await VaultChef.connect(owner).addMultipleToWhitelist([user1.address, MockZap.address, user2.address, owner.address]);
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
      await expect(VaultChef.connect(user1).setVault(0, 0))
        .to.be.revertedWith("Ownable: caller is not the owner");
      await expect(VaultChef.connect(user1).setURI("test"))
        .to.be.revertedWith("Ownable: caller is not the owner");
      await expect(VaultChef.connect(user1).changeMetadata("testName", "testSymb", 8))
        .to.be.revertedWith("Ownable: caller is not the owner");
      await expect(VaultChef.connect(user1).inCaseTokensGetStuck(TestToken.address, user1.address))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("It should not allow adding a vault with a performance fee > 10%", async function () {
      await expect(VaultChef.connect(owner).addVault(MockStrategy.address, 1001))
        .to.be.revertedWith("!valid");
      expect(await VaultChef.connect(owner).addVault(MockStrategy.address, 1000))
        .to.emit(VaultChef, "VaultAdded")
        .withArgs(0, MockStrategy.address, 1000);
    });

    it("It should have poolLength zero", async function () {
      expect(await VaultChef.poolLength()).to.be.equals(0);
    });


    it("It should not allow ownership transfer to pending owner after renunciation", async function () {
      await VaultChef.connect(owner).setPendingOwner(user1.address);
      await VaultChef.connect(owner).renounceOwnership();
      await expect(VaultChef.connect(user1).transferOwnership())
        .to.be.revertedWith("Ownable: caller is not the pendingOwner");
    });

    it("It should allow governance to withdraw stuck tokens from the vaultchef", async function () {
      await TestToken.connect(owner).mint(1000);
      await TestToken.connect(owner).transfer(VaultChef.address, 1000);
      expect(await TestToken.balanceOf(VaultChef.address)).to.be.equal(1000);
      await expect(VaultChef.connect(owner).inCaseTokensGetStuck(TestToken.address, user2.address))
        .to.emit(VaultChef, "InCaseTokenStuck")
        .withArgs(TestToken.address, user2.address, 1000);
      expect(await TestToken.balanceOf(VaultChef.address)).to.be.equal(0);
      expect(await TestToken.balanceOf(user2.address)).to.be.equal(1000);
    });

    it("It should revert operations on nonexistent vault", async function () {
      await expect(VaultChef.connect(owner).pauseVault(0, true))
        .to.revertedWith("!no vault");
      await expect(VaultChef.connect(owner).harvest(0))
        .to.revertedWith("!no vault");
      await expect(VaultChef.connect(owner).setVault(0, 100))
        .to.revertedWith("!no vault");
      await expect(VaultChef.connect(owner).panicVault(0))
        .to.revertedWith("!no vault");
      await expect(VaultChef.connect(owner).inCaseVaultTokensGetStuck(0, TestToken.address, user2.address, 1000))
        .to.revertedWith("!no vault");
      await expect(VaultChef.poolInfo(0))
        .to.be.revertedWith("!no vault");

      await expect(VaultChef.totalUnderlying(0))
        .to.be.revertedWith("!no vault");

      await expect(VaultChef.userInfo(0, user1.address))
        .to.be.revertedWith("!no vault");
    });

    it("It should have dummy masterchef startBlock function", async function () {
      expect(await VaultChef.startBlock()).to.be.gt(0);
    });

    it("It should have zero allocPoints", async function () {
      expect(await VaultChef.totalAllocPoint()).to.be.equals(0);
    });

    describe("With first mock vault (5% performance fee)", function () {
      this.beforeEach("Should add vault", async function () {
        expect(await VaultChef.connect(owner).addVault(MockStrategy.address, 500))
          .to.emit(VaultChef, "VaultAdded")
          .withArgs(0, MockStrategy.address, 500);
      });

      it("It should not allow governance to withdraw stuck staking tokens from the strategy", async function () {
        await TestToken.connect(owner).mint(1000);
        await TestToken.connect(owner).transfer(MockStrategy.address, 1000);
        await expect(VaultChef.connect(owner).inCaseVaultTokensGetStuck(0, TestToken.address, user2.address, 1000))
          .to.be.revertedWith("!underlying");
      });
      it("It should not allow strategy to withdraw staking tokens on inCaseVaultTokensGetStuck", async function () {
        await TestToken.connect(owner).mint(1000);
        await TestToken.connect(owner).transfer(MockStrategy.address, 1000);
        await MockStrategy.setMaliciousMode(true);
        await expect(VaultChef.connect(owner).inCaseVaultTokensGetStuck(0, TestToken2.address, user2.address, 1000))
          .to.be.revertedWith("!unsafe");
      });
      it("It should allow governance to withdraw stuck non-staking tokens from the strategy", async function () {
        await TestToken2.connect(owner).mint(1000);
        await TestToken2.connect(owner).transfer(MockStrategy.address, 1000);
        await expect(VaultChef.connect(owner).inCaseVaultTokensGetStuck(0, TestToken2.address, user2.address, 1000))
          .to.emit(VaultChef, "VaultInCaseTokenStuck")
          .withArgs(0, TestToken2.address, user2.address, 1000);
      });

      it("It should allow governance to withdraw stuck non-staking tokens from the strategy using correct gas", async function () {
        await TestToken2.connect(owner).mint(1000);
        await TestToken2.connect(owner).transfer(MockStrategy.address, 1000);
        const tx = await VaultChef.connect(owner).inCaseVaultTokensGetStuck(0, TestToken2.address, user2.address, 1000);
        const receipt = await tx.wait();
        expect(receipt.gasUsed).to.be.equal(96690);

      });

      it("Should be pausable", async function () {
        expect(await VaultChef.connect(owner).pauseVault(0, true))
          .to.emit(VaultChef, "VaultPaused")
          .withArgs(0, true);
        expect((await VaultChef.poolInfo(0))[1]).to.be.equal(0); // allocPoint
        expect((await VaultChef.totalAllocPoint())).to.be.equal(0);
      });

      it("It should not be unpausable while unpaused", async function () {
        await expect(VaultChef.connect(owner).pauseVault(0, false))
          .to.be.revertedWith("!set");
      });

      it("It should not allow adding the strategy twice", async function () {
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
        expect(vault[1]).to.be.equals(0); // lastHarvestTimestamp
        expect(vault[2]).to.be.equals(MockStrategy.address); // strategy
        expect(vault[3]).to.be.equals(500); // performance fee
        expect(vault[4]).to.be.equals(false); // paused
        expect(vault[5]).to.be.equals(false); // panicked
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

        it("It fails deposits and withdraws on nonexistent vaults [user1]", async function () {
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

        it("It fails depositUnderlying with too high minimum received", async function () {
          await expect(VaultChef.connect(user1).depositUnderlying(0, ethers.utils.parseEther("1.0"), false, ethers.utils.parseEther("1.0").add(1)))
            .to.be.revertedWith("!min not received");
        });

        it("It should revert pull based deposits if not whitelisted", async function () {
          const amount = ethers.utils.parseEther("1.0");
          await expect(MockZap.connect(user1).depositPull(0, amount, 0))
            .to.be.revertedWith("!whitelist");
        });

        it("It should revert pull based deposits if insufficient allowance given to zapping contract", async function () {
          expect(await VaultChef.canDoPullDeposits(MockZap.address)).to.be.equal(false);
          await expect(VaultChef.connect(owner).setPullDepositor(MockZap.address, true))
            .to.emit(VaultChef, "PullDepositorSet")
            .withArgs(MockZap.address, true);
          expect(await VaultChef.canDoPullDeposits(MockZap.address)).to.be.equal(true);
          const amount = ethers.utils.parseEther("1.0");
          await expect(MockZap.connect(user1).depositPull(0, amount, 0))
            .to.be.revertedWith("ERC20: transfer amount exceeds allowance");
        });

        it("It should allow for pull-based depositing", async function () {
          expect(await VaultChef.canDoPullDeposits(MockZap.address)).to.be.equal(false);
          await expect(VaultChef.connect(owner).setPullDepositor(MockZap.address, true))
            .to.emit(VaultChef, "PullDepositorSet")
            .withArgs(MockZap.address, true);
          expect(await VaultChef.canDoPullDeposits(MockZap.address)).to.be.equal(true);

          const amount = ethers.utils.parseEther("1.0");
          const balanceBefore = await TestToken.balanceOf(user1.address);

          await TestToken.connect(user1).approve(MockZap.address, amount);
          await expect(MockZap.connect(user1).depositPull(0, amount, amount))
            .to.emit(VaultChef, "Deposit")
            .withArgs(0, MockZap.address, amount, amount); // vaultId, user, shares, underlying
          const balanceAfter = await TestToken.balanceOf(user1.address);
          expect(balanceBefore.sub(balanceAfter)).to.be.equal(amount);
          expect(await VaultChef.balanceOf(user1.address, 0)).to.be.equal(amount);
          expect(await VaultChef.totalSupply(0)).to.be.equal(amount);
        });

        it("It should revert pull-based deposits if minimum shares is set too high", async function () {
          expect(await VaultChef.canDoPullDeposits(MockZap.address)).to.be.equal(false);
          await expect(VaultChef.connect(owner).setPullDepositor(MockZap.address, true))
            .to.emit(VaultChef, "PullDepositorSet")
            .withArgs(MockZap.address, true);
          expect(await VaultChef.canDoPullDeposits(MockZap.address)).to.be.equal(true);

          const amount = ethers.utils.parseEther("1.0");
          await TestToken.connect(user1).approve(MockZap.address, amount);
          await expect(MockZap.connect(user1).depositPull(0, amount, amount.add(1)))
            .to.be.revertedWith("!min not received");
        });

        it("It should allow depositing and withdrawing 1e34 tokens without overflow", async function () {
          const amount1 = BigNumber.from("9").mul(BigNumber.from("10").pow(BigNumber.from("33")));
          const amount2 = BigNumber.from("1").mul(BigNumber.from("10").pow(BigNumber.from("33")));
          const harvest = amount1.mul(BigNumber.from("100000"));
          await TestToken.connect(user1).mint(amount1);
          await TestToken.connect(user2).mint(amount2);
          await TestToken.connect(user1).approve(VaultChef.address, amount1);
          await TestToken.connect(user2).approve(VaultChef.address, amount2);
          await VaultChef.connect(user1).deposit(0, amount1);
          await VaultChef.connect(user2).deposit(0, amount2);
          await TestToken.connect(owner).mint(harvest);
          await TestToken.connect(owner).approve(MockStrategy.address, harvest);
          await MockStrategy.connect(owner).setNextHarvest(harvest);
          await VaultChef.connect(owner).harvest(0);
          await VaultChef.connect(user1).withdrawShares(0, amount1, 0);
          await VaultChef.connect(user2).withdrawShares(0, amount2, 0);
          await VaultChef.connect(owner).emergencyWithdraw(0);


          expect(await VaultChef.balanceOf(user1.address, 0)).to.be.equal(0, "user1!");
          expect(await VaultChef.balanceOf(user2.address, 0)).to.be.equal(0, "user2!");
          expect(await VaultChef.balanceOf(owner.address, 0)).to.be.equal(0, "owner!");
          expect(await VaultChef.totalSupply(0)).to.be.equal(0, "supply!");
          expect(await VaultChef.totalUnderlying(0)).to.be.equal(0, "underlying!");
        });


        it("It should use correct gas on depositUnderlying with minimum", async function () {
          const deposit1amount = ethers.utils.parseEther("1.0");
          const tx = await VaultChef.connect(user1).depositUnderlying(0, deposit1amount, false, deposit1amount);
          const receipt = await tx.wait();
          expect(receipt.gasUsed).to.be.equal(203123);

        });

        it("It should revert deposits over 1e34 underlying tokens", async function () {
          const amount = BigNumber.from("1").add(BigNumber.from("10").pow(BigNumber.from("34")));
          await TestToken.connect(user1).mint(amount);
          await TestToken.connect(user1).approve(VaultChef.address, amount);
          await expect(VaultChef.connect(user1).deposit(0, amount))
            .to.be.revertedWith("!unsafe");
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

          it("It should allow withdrawShares with minimum", async function () {
            await expect(VaultChef.connect(user1).withdrawShares(0, deposit1amount, deposit1amount))
              .to.emit(VaultChef, "Withdraw")
              .withArgs(0, user1.address, user1.address, deposit1amount, deposit1amount); // vaultId, user, shares, underlying
            expect(await VaultChef.balanceOf(user1.address, 0)).to.be.equal(0);
            expect(await VaultChef.totalSupply(0)).to.be.equal(0);
            expect(await VaultChef.totalUnderlying(0)).to.be.equal(0);
            expect(await TestToken.balanceOf(user1.address)).to.be.equal(startBalUser1);
          });

          it("It should use correct gas on withdrawShares with minimum ", async function () {
            const tx = await VaultChef.connect(user1).withdrawShares(0, deposit1amount, deposit1amount);
            const receipt = await tx.wait();
            expect(receipt.gasUsed).to.eq(108028);

          });

          it("It should revert withdrawShares with too high minimum", async function () {
            await expect(VaultChef.connect(user1).withdrawShares(0, deposit1amount, deposit1amount.add(1)))
              .to.be.revertedWith("!min not received");
          });

          it("It should revert deposits and withdrawals of zero", async function () {
            await expect(VaultChef.connect(user1).deposit(0, 0))
              .to.be.revertedWith("!zero shares");
            await expect(VaultChef.connect(user1).depositUnderlying(0, 0, false, 0))
              .to.be.revertedWith("!zero shares");
            await expect(VaultChef.connect(user1).withdrawShares(0, 0, 0))
              .to.be.revertedWith("!zero shares");
            await expect(VaultChef.connect(user1).withdraw(0, 0))
              .to.be.revertedWith("!zero shares");
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


          describe("With panic vault", function () {
            this.beforeEach("Should panic vault", async function () {
              await expect(VaultChef.connect(owner).panicVault(0))
                .to.emit(VaultChef, "VaultPanicked")
                .withArgs(0); // vaultId, user, shares, underlying

              const vault = await VaultChef.vaultInfo(0);
              expect(vault[4]).to.be.equals(true); // paused
              expect(vault[5]).to.be.equals(true); // panicked
            });

            it("It should not be unpausable", async function () {
              await expect(VaultChef.connect(owner).pauseVault(0, false))
                .to.be.revertedWith("!panicked");
            });

            it("It should not allow panicking twice", async function () {
              await expect(VaultChef.connect(owner).panicVault(0))
                .to.be.revertedWith("!panicked");
            });

            it("It should not allow harvesting and depositing", async function () {
              await expect(VaultChef.connect(owner).harvest(0))
                .to.be.revertedWith("!paused");
              await expect(VaultChef.connect(owner).deposit(0, 100))
                .to.be.revertedWith("!paused");
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
              expect(vault[4]).to.be.equals(true); // paused
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
              expect(vault[4]).to.be.equals(false); // paused
            });

            it("It should not allow deposits", async function () {
              await expect(VaultChef.connect(user1).deposit(0, deposit1amount))
                .to.be.revertedWith("!paused");
              await expect(VaultChef.connect(user1).depositUnderlying(0, deposit1amount, false, 0))
                .to.be.revertedWith("!paused");
            });

            it("It should not allow harvests", async function () {
              const harvest1amount = ethers.utils.parseEther("0.1");
              await MockStrategy.connect(user1).setNextHarvest(harvest1amount);
              await expect(VaultChef.connect(owner).harvest(0))
                .to.revertedWith("!paused");
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

              const vault = await VaultChef.vaultInfo(0);
              expect(vault[4]).to.be.equals(true); // paused
              expect(vault[5]).to.be.equals(true); // panicked
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

            it("It should allow updating the deposit fee and correctly account for new deposit fee on harvest", async function () {
              expect(await VaultChef.connect(owner).setVault(0, 100))
                .to.emit(VaultChef, "VaultPerformanceFeeSet")
                .withArgs(0, 100);

              const vault = await VaultChef.vaultInfo(0);
              expect(vault[3]).to.be.equals(100); // performance fee

              // Validate that there are no side effects
              expect(await VaultChef.balanceOf(user1.address, 0)).to.be.equal(deposit1amount);
              expect(await VaultChef.balanceOf(owner.address, 0)).to.be.equal(vaultSharesToOwner);
              expect(await VaultChef.totalSupply(0)).to.be.equal(deposit1amount.add(vaultSharesToOwner));
              expect(await VaultChef.totalUnderlying(0)).to.be.equal(deposit1amount.add(harvest1amount));

              // second harvest
              const vaultSharesToOwner2 = BigNumber.from("837121212121212");
              await MockStrategy.connect(user1).setNextHarvest(harvest1amount);
              await expect(VaultChef.connect(owner).harvest(0))
                .to.emit(VaultChef, "VaultHarvest")
                .withArgs(0, harvest1amount);
              // validate that there was a 1% deposit fee

              expect(await VaultChef.balanceOf(user1.address, 0)).to.be.equal(deposit1amount);
              expect(await VaultChef.balanceOf(owner.address, 0)).to.be.equal(vaultSharesToOwner.add(vaultSharesToOwner2));
              expect(await VaultChef.totalSupply(0)).to.be.equal(deposit1amount.add(vaultSharesToOwner).add(vaultSharesToOwner2));
              expect(await VaultChef.totalUnderlying(0)).to.be.equal(deposit1amount.add(harvest1amount).add(harvest1amount));
            });

            it("It should not allow setting a performance fee > 10%", async function () {
              expect(await VaultChef.connect(owner).setVault(0, 1000))
                .to.emit(VaultChef, "VaultPerformanceFeeSet")
                .withArgs(0, 1000);
              await expect(VaultChef.connect(owner).setVault(0, 1001))
                .to.be.revertedWith("!valid");
            });
            it("It should revert withdrawSharesTo since msg.sender is a contract", async function () {
              await expect(VaultChef.connect(user1).withdrawSharesTo(0, deposit1amount, BigNumber.from("1095022624434389140"), user2.address))
                .to.be.revertedWith("!to phishing");
            });

            it("It should allow withdrawShares with minimum", async function () {
              const expectedUnderlyingReceived = BigNumber.from("1095022624434389140");
              await expect(VaultChef.connect(user1).withdrawShares(0, deposit1amount, expectedUnderlyingReceived))
                .to.emit(VaultChef, "Withdraw")
                .withArgs(0, user1.address, user1.address, deposit1amount, expectedUnderlyingReceived); // vaultId, user, shares, underlying
              expect(await VaultChef.balanceOf(user1.address, 0)).to.be.equal(0);
              expect(await VaultChef.totalSupply(0)).to.be.equal(vaultSharesToOwner);
              expect(await VaultChef.totalUnderlying(0)).to.be.equal("4977375565610860");
              expect(await TestToken.balanceOf(user1.address)).to.be.equal(startBalUser1.add(BigNumber.from("95022624434389140")));
            });

            // it("It should allow withdrawShares with underlying withdraw fee", async function () {
            //   const expectedUnderlyingReceived = BigNumber.from("1095022624434389140");
            //   const toFee = BigNumber.from("100050123123");
            //   await MockStrategy.setWithdrawFee(toFee);
            //   await expect(VaultChef.connect(user1).withdrawShares(0, deposit1amount, expectedUnderlyingReceived.sub(toFee)))
            //     .to.emit(VaultChef, "Withdraw")
            //     .withArgs(0, user1.address, user1.address, deposit1amount, expectedUnderlyingReceived.sub(toFee)); // vaultId, user, shares, underlying
            //   expect(await VaultChef.balanceOf(user1.address, 0)).to.be.equal(0);
            //   expect(await VaultChef.totalSupply(0)).to.be.equal(vaultSharesToOwner);
            //   expect(await VaultChef.totalUnderlying(0)).to.be.equal("4977375565610860");
            //   expect(await TestToken.balanceOf(user1.address)).to.be.equal(startBalUser1.add(BigNumber.from("95022624434389140")).sub(toFee));
            // });

            it("It should revert withdrawSharesTo without approval to zapping contract", async function () {
              const expectedUnderlyingReceived = BigNumber.from("1095022624434389140");
              await expect(MockZap.connect(user1).withdrawSharesTo(0, deposit1amount, expectedUnderlyingReceived, user2.address))
                .to.be.revertedWith("RC1155: caller is not owner nor approved");
            });

            it("It should allow withdrawSharesTo through zapping contract", async function () {
              const expectedUnderlyingReceived = BigNumber.from("1095022624434389140");
              await expect(VaultChef.connect(user1).setApprovalForAll(MockZap.address, true))
                .to.emit(VaultChef, "ApprovalForAll")
                .withArgs(user1.address, MockZap.address, true);

              await expect(MockZap.connect(user1).withdrawSharesTo(0, 0, expectedUnderlyingReceived, user2.address))
                .to.be.revertedWith("!zero shares");

              expect(await MockZap.connect(user1).withdrawSharesTo(0, deposit1amount, expectedUnderlyingReceived, user2.address))
                .to.emit(VaultChef, "Withdraw")
                .withArgs(0, MockZap.address, user2.address, deposit1amount, expectedUnderlyingReceived); // vaultId, user, shares, underlying
              expect(await VaultChef.balanceOf(user1.address, 0)).to.be.equal(0);
              expect(await VaultChef.totalSupply(0)).to.be.equal(vaultSharesToOwner);
              expect(await VaultChef.totalUnderlying(0)).to.be.equal("4977375565610860");
              expect(await TestToken.balanceOf(user2.address)).to.be.equal(expectedUnderlyingReceived);
            });


            it("It should revert withdrawSharesTo if minimum received is set too large", async function () {
              const expectedUnderlyingReceived = BigNumber.from("1095022624434389140");
              await expect(VaultChef.connect(user1).setApprovalForAll(MockZap.address, true))
                .to.emit(VaultChef, "ApprovalForAll")
                .withArgs(user1.address, MockZap.address, true);
              await expect(MockZap.connect(user1).withdrawSharesTo(0, deposit1amount, expectedUnderlyingReceived.add(1), user2.address))
                .to.be.revertedWith("!min not received");
            });

            // it("It should revert withdrawSharesTo if minimum received is set too large due to withdraw fee", async function () {
            //   const expectedUnderlyingReceived = BigNumber.from("1095022624434389140");
            //   await expect(VaultChef.connect(user1).setApprovalForAll(MockZap.address, true))
            //     .to.emit(VaultChef, "ApprovalForAll")
            //     .withArgs(user1.address, MockZap.address, true);
            //   await MockStrategy.setWithdrawFee(BigNumber.from("1"));
            //   await expect(MockZap.connect(user1).withdrawSharesTo(0, deposit1amount, expectedUnderlyingReceived, user2.address))
            //     .to.be.revertedWith("!min not received");
            // });

            it("It should have zero balances after everyone withdraws", async function () {
              const expectedUnderlyingReceived = BigNumber.from("1095022624434389140");
              const expectedOwnerUnderlyingReceived = BigNumber.from("4977375565610860");
              await expect(VaultChef.connect(user1).withdrawShares(0, deposit1amount, expectedUnderlyingReceived))
                .to.emit(VaultChef, "Withdraw")
                .withArgs(0, user1.address, user1.address, deposit1amount, expectedUnderlyingReceived); // vaultId, user, shares, underlying
              await expect(VaultChef.connect(owner).withdrawShares(0, vaultSharesToOwner, expectedOwnerUnderlyingReceived))
                .to.emit(VaultChef, "Withdraw")
                .withArgs(0, owner.address, owner.address, vaultSharesToOwner, expectedOwnerUnderlyingReceived); // vaultId, user, shares, underlying
              expect(await VaultChef.balanceOf(user1.address, 0)).to.be.equal(0);
              expect(await VaultChef.balanceOf(owner.address, 0)).to.be.equal(0);
              expect(await VaultChef.totalSupply(0)).to.be.equal(0);
              expect(await VaultChef.totalUnderlying(0)).to.be.equal(0);
              expect(await TestToken.balanceOf(user1.address)).to.be.equal(startBalUser1.add(BigNumber.from("95022624434389140")));
            });

            it("It should revert withdrawShares with too high minimum", async function () {
              await expect(VaultChef.connect(user1).withdrawShares(0, deposit1amount, BigNumber.from("1095022624434389140").add(BigNumber.from("1"))))
                .to.be.revertedWith("!min not received");
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
              expect((await VaultChef.vaultInfo(0))[1]).to.be.equal(timestamp);
            });
          });
        });
      });
      describe("With second withdraw fee mock vault (0% performance fee)", function () {
        this.beforeEach("Should add vault", async function () {
          expect(await VaultChef.strategyExists(WFeeMockStrategy.address)).to.be.equal(false);
          expect(await VaultChef.strategyVaultId(WFeeMockStrategy.address)).to.be.equal(0);
          expect(await VaultChef.connect(owner).addVault(WFeeMockStrategy.address, 0))
            .to.emit(VaultChef, "VaultAdded")
            .withArgs(1, WFeeMockStrategy.address, 0);
          expect(await VaultChef.strategyExists(WFeeMockStrategy.address)).to.be.equal(true);
          expect(await VaultChef.strategyVaultId(WFeeMockStrategy.address)).to.be.equal(1);
        });

        it("isValidVault should return true for the first two indices", async function () {
          expect(await VaultChef.isValidVault(0)).to.be.equals(true);
          expect(await VaultChef.isValidVault(1)).to.be.equals(true);
          expect(await VaultChef.isValidVault(2)).to.be.equals(false);
        });

        it("It should have poolLength two", async function () {
          expect(await VaultChef.poolLength()).to.be.equals(2);
        });

        it("It should have two allocPoints", async function () {
          expect(await VaultChef.totalAllocPoint()).to.be.equals(2);
        });

        it("It should have zero totalUnderlying", async function () {
          expect(await VaultChef.totalUnderlying(1)).to.be.equals(0);
        });
        describe("With 1 ether MC-based deposit [user1]", function () {
          const deposit1amount = ethers.utils.parseEther("1.0");
          this.beforeEach("Deposit 1 ether", async function () {
            await TestToken.connect(user1).approve(VaultChef.address, BigNumber.from("10").pow(BigNumber.from("35")));
            await expect(VaultChef.connect(user1).deposit(1, deposit1amount))
              .to.emit(VaultChef, "Deposit")
              .withArgs(1, user1.address, deposit1amount, deposit1amount); // vaultId, user, shares, underlying
          });

          it("It should have deducted 1 ether from sender", async function () {
            expect(await TestToken.balanceOf(user1.address)).to.be.equal(startBalUser1.sub(ethers.utils.parseEther("1.0")));
          });

          it("It should not allow foreign withdrawals [user2]", async function () {
            await expect(VaultChef.connect(user2).withdraw(1, deposit1amount))
              .to.be.revertedWith("!insufficient shares");
          });

          it("It should allow withdrawShares", async function () {
            await expect(VaultChef.connect(user1).withdrawShares(1, deposit1amount, 0))
              .to.emit(VaultChef, "Withdraw")
              .withArgs(1, user1.address, user1.address, deposit1amount, deposit1amount); // vaultId, user, shares, underlying
            expect(await VaultChef.balanceOf(user1.address, 1)).to.be.equal(0);
            expect(await VaultChef.totalSupply(1)).to.be.equal(0);
            expect(await VaultChef.totalUnderlying(1)).to.be.equal(0);
            expect(await TestToken.balanceOf(user1.address)).to.be.equal(startBalUser1);
          });
          it("It should allow withdrawShares with withdrawal fee", async function () {
            await WFeeMockStrategy.setWithdrawFee(1000);
            await expect(VaultChef.connect(user1).withdrawShares(1, deposit1amount, 0))
              .to.emit(VaultChef, "Withdraw")
              .withArgs(1, user1.address, user1.address, deposit1amount, deposit1amount.sub(1000)); // vaultId, user, shares, underlying
            expect(await VaultChef.balanceOf(user1.address, 1)).to.be.equal(0);
            expect(await VaultChef.totalSupply(1)).to.be.equal(0);
            expect(await VaultChef.totalUnderlying(1)).to.be.equal(0);
            expect(await TestToken.balanceOf(user1.address)).to.be.equal(startBalUser1.sub(1000));
          });

          it("It should have updated userInfo", async function () {
            const userInfo = await VaultChef.userInfo(1, user1.address);
            expect(userInfo[0]).to.be.equal(deposit1amount);
            expect(userInfo[1]).to.be.equal(0);
          });
        });
      });
    });
  });

});
