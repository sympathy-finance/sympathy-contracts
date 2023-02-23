const { expect } = require("chai");
const { ethers } = require("hardhat");
import { deployContract, expandDecimals, bigNumberify, encode } from '../shared/utils';

describe("MintingStation", function () {
  const MINTER_ROLE = '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6';

  let owner;
  let addr1;
  let addr2;
  let addrs;
  let token0;
  let token1;
  let whitelist;

  beforeEach(async function () {
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    const Token0 = await hre.ethers.getContractFactory("SPY");
    token0 = await Token0.deploy();
    await token0.deployed();
    await token0.setMinter(owner.address, true);
    await token0.mint(addr1.address, expandDecimals(5, 18))

    const Token1 = await hre.ethers.getContractFactory("SPY");
    token1 = await Token1.deploy();
    await token1.deployed();
    await token1.setMinter(owner.address, true);
    await token1.mint(addr2.address, expandDecimals(5, 18))

    const Whitelist = await hre.ethers.getContractFactory("Whitlelist");
    whitelist = await Whitelist.deploy(token0.address, token1.address);
    await whitelist.deployed();

    await token0.connect(addr1).approve(whitelist.address, expandDecimals(1000000, 18))
    await token1.connect(addr2).approve(whitelist.address, expandDecimals(1000000, 18))

    await token1.connect(addr2).transfer(whitelist.address, expandDecimals(5, 18))
  });

  describe('Deployment', function() {
    it("Should set the right owner", async function() {
      // check nft owner
      console.log(await token0.name())
      expect(true).to.equal(true);
    });
  });

  describe('Test', function() {
    it("setWhitlelistStatus", async function() {
        await whitelist.setWhitlelistStatus(true, false, false);
        expect(await whitelist.isDeposit()).to.equal(true);
        expect(await whitelist.isClaimWhitelist()).to.equal(false);
    });

    it("Should deposit", async function() {
        await whitelist.setWhitlelistStatus(true, false, false);
        await whitelist.connect(addr1).deposit(expandDecimals(5, 18));
        expect(await whitelist.depositUsers(addr1.address)).to.equal(expandDecimals(5, 18));
    });

    it("Should withdraw fund", async function() {
        await whitelist.setWhitlelistStatus(true, false, false);
        await whitelist.connect(addr1).deposit(expandDecimals(5, 18));
        await whitelist.connect(owner).withDrawnFund(expandDecimals(1, 18));
        expect(await token0.balanceOf(owner.address)).to.equal(expandDecimals(1, 18));
    });

    it("Should withdraw airdrop token", async function() {
        await whitelist.setWhitlelistStatus(true, false, false);
        await whitelist.connect(addr1).deposit(expandDecimals(5, 18));
        await whitelist.setWhitlelistStatus(false, false, true);
        await whitelist.connect(addr1).claimAirdropToken();
        expect(await token1.balanceOf(addr1.address)).to.equal(expandDecimals(5, 18));
    });

    it("Should claim whitelist token", async function() {
        await whitelist.setWhitlelistStatus(true, false, false);
        await whitelist.connect(addr1).deposit(expandDecimals(5, 18));
        await whitelist.setWhitlelistStatus(false, true, false);
        await whitelist.connect(addr1).claimWhitlelist();
        expect(await token0.balanceOf(addr1.address)).to.equal(expandDecimals(5, 18));
    });
  });
});
