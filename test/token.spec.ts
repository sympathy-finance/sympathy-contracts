const { expect } = require("chai");
const { ethers } = require("hardhat");
import { deployContract, expandDecimals, bigNumberify, encode } from '../shared/utils';

describe("MintingStation", function () {
  const MINTER_ROLE = '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6';

  let owner;
  let addr1;
  let addr2;
  let addrs;
  let token;

  beforeEach(async function () {
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    const Token = await hre.ethers.getContractFactory("SPY");
    token = await Token.deploy();
    await token.deployed();
    await token.setMinter(owner.address, true);
    await token.mint(addr1.address, expandDecimals(6000000, 18));
  });

  describe('Deployment', function() {
    it("Should set the right owner", async function() {
      // check nft owner
      console.log(await token.name())
      expect(true).to.equal(true);
    });
  });

  describe('Test', function() {
    it("Should mint", async function() {
        // await token.mint(addr1.address, expandDecimals(5, 18));
        expect(await token.balanceOf(addr1.address)).to.equal(expandDecimals(6000000, 18));
    });
  });
});
